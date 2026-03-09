import {
  DEFAULT_X_APP_NAME,
  DEFAULT_X_MODE,
  DEFAULT_X_SONIC
} from "../config.js";
import { SlackClient } from "./slack-client.js";
import { normalizeWorkspace, parseWorkspaceContextFromBody } from "./workspace-context.js";
import type { SlackConversation, SlackMessage } from "../types/slack-web.js";
import type {
  ChannelSectionsResponse,
  ConversationsInfoResponse,
  CountsResponse,
  DmsResponse,
  HistoryResponse,
  UserBootResponse,
  UsersInfoResponse
} from "../types/slack-web.js";
import type { WorkspaceContext } from "../types/auth.js";

interface BaseListOptions {
  workspace: string;
  limit?: number;
}

interface HistoryOptions extends BaseListOptions {
  channel: string;
  oldest?: string;
  cursor?: string;
}

interface RepliesOptions extends BaseListOptions {
  channel: string;
  threadTs: string;
  cursor?: string;
}

interface HistoryResult {
  messages: SlackMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

function parseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

const MOJIBAKE_MARKERS = /[\u00C3\u00C2\u00C4\u00C5\u00C6\u00E2]/u;

function mojibakeScore(value: string): number {
  const matches = value.match(/[\u00C3\u00C2\u00C4\u00C5\u00C6\u00E2]/gu);
  return matches ? matches.length : 0;
}

function repairMojibakeText(value: string | undefined): string | undefined {
  if (!value || !MOJIBAKE_MARKERS.test(value)) {
    return value;
  }

  const repaired = Buffer.from(value, "latin1").toString("utf8");
  if (repaired.includes("�")) {
    return value;
  }

  return mojibakeScore(repaired) < mojibakeScore(value) ? repaired : value;
}
function assertOk(response: { ok: boolean; error?: string }, endpoint: string): void {
  if (!response.ok) {
    const error = response.error || "unknown error";
    if (error === "team_is_restricted") {
      throw new Error(
        `${endpoint} failed: ${error}. Try using the full workspace domain from workspace:list, e.g. seconddinner.enterprise.slack.com`
      );
    }
    throw new Error(`${endpoint} failed: ${error}`);
  }
}

function toCommonForm(context: WorkspaceContext): Record<string, string> {
  return {
    token: context.token || "",
    _x_reason: "cli-read",
    _x_mode: context.xMode || DEFAULT_X_MODE,
    _x_sonic: context.xSonic || DEFAULT_X_SONIC,
    _x_app_name: context.xAppName || DEFAULT_X_APP_NAME
  };
}

export class SlackWebApi {
  private readonly contextByWorkspace = new Map<string, WorkspaceContext>();
  private readonly userNameCache = new Map<string, string>();
  private readonly channelNameCache = new Map<string, string>();

  constructor(private readonly rootClient: SlackClient) {}

  private workspaceClient(workspace: string): SlackClient {
    const workspaceSlug = normalizeWorkspace(workspace);
    return new SlackClient({
      baseUrl: `https://${workspaceSlug}.slack.com`,
      cookieJar: this.rootClient.getCookieJar()
    });
  }

  async bootstrapWorkspaceContext(workspace: string): Promise<WorkspaceContext> {
    const workspaceSlug = normalizeWorkspace(workspace);
    const existing = this.contextByWorkspace.get(workspaceSlug);
    if (existing) {
      return existing;
    }

    const client = this.workspaceClient(workspaceSlug);
    const pageResponse = await client.get("/client");
    const pageContext = parseWorkspaceContextFromBody(workspaceSlug, pageResponse.body);

    let token = pageContext.token;
    try {
      const bootResponseRaw = await client.postForm("/api/client.userBoot", {
        token: pageContext.token,
        _x_reason: "initial-data",
        _x_mode: pageContext.xMode,
        _x_sonic: pageContext.xSonic,
        _x_app_name: pageContext.xAppName
      });

      const boot = parseJson<UserBootResponse>(bootResponseRaw.body);
      if (boot.ok) {
        token = boot.token || boot.api_token || token;
      }
    } catch {
      // Keep page-derived token fallback; userBoot may reject certain params in some workspaces.
    }

    const context: WorkspaceContext = {
      ...pageContext,
      token
    };

    if (!context.token) {
      throw new Error(`Unable to discover API token for workspace ${workspaceSlug}`);
    }

    this.contextByWorkspace.set(workspaceSlug, context);
    return context;
  }

  private async resolveUserName(workspace: string, userId: string | undefined): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }
    const cached = this.userNameCache.get(userId);
    if (cached) {
      return cached;
    }

    const context = await this.bootstrapWorkspaceContext(workspace);
    const client = this.workspaceClient(workspace);
    try {
      const raw = await client.postForm("/api/users.info", {
        ...toCommonForm(context),
        user: userId
      });
      const response = parseJson<UsersInfoResponse>(raw.body);
      if (response.ok) {
        const name =
          response.user?.profile?.display_name ||
          response.user?.real_name ||
          response.user?.profile?.real_name ||
          response.user?.name ||
          userId;
        this.userNameCache.set(userId, name);
        return name;
      }
    } catch {
      return userId;
    }
    return userId;
  }

  private async resolveChannelName(workspace: string, channelId: string): Promise<string | undefined> {
    const cached = this.channelNameCache.get(channelId);
    if (cached) {
      return cached;
    }

    const context = await this.bootstrapWorkspaceContext(workspace);
    const client = this.workspaceClient(workspace);
    try {
      const raw = await client.postForm("/api/conversations.info", {
        ...toCommonForm(context),
        channel: channelId,
        include_locale: false,
        include_num_members: false
      });
      const response = parseJson<ConversationsInfoResponse>(raw.body);
      if (response.ok) {
        const name = response.channel?.name;
        if (name) {
          this.channelNameCache.set(channelId, name);
        }
        return name;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  async listChannels(options: BaseListOptions): Promise<SlackConversation[]> {
    const context = await this.bootstrapWorkspaceContext(options.workspace);
    const client = this.workspaceClient(options.workspace);

    const sectionsRaw = await client.postForm("/api/users.channelSections.list", {
      ...toCommonForm(context)
    });
    const sections = parseJson<ChannelSectionsResponse>(sectionsRaw.body);
    assertOk(sections, "users.channelSections.list");

    const countsRaw = await client.postForm("/api/client.counts", {
      ...toCommonForm(context),
      include_all_unreads: true,
      include_file_channels: false,
      thread_counts_by_channel: true
    });
    const counts = parseJson<CountsResponse>(countsRaw.body);
    assertOk(counts, "client.counts");

    const orderedIds = (sections.channel_sections ?? [])
      .flatMap((section) => section.channel_ids ?? [])
      .filter(Boolean);

    const countsById = new Map(
      (counts.channels ?? [])
        .filter((channel) => channel.id)
        .map((channel) => [channel.id as string, channel])
    );

    const merged = orderedIds.map((id) => {
      const fromCounts = countsById.get(id);
      return {
        id,
        name: fromCounts?.name,
        unreadCount: fromCounts?.unread_count ?? 0,
        latestTs: fromCounts?.latest?.ts
      } satisfies SlackConversation;
    });

    const unique = new Map<string, SlackConversation>();
    for (const item of [
      ...merged,
      ...(counts.channels ?? []).map((channel) => ({
        id: channel.id || "",
        name: channel.name,
        unreadCount: channel.unread_count ?? 0,
        latestTs: channel.latest?.ts
      }))
    ]) {
      if (!item.id) {
        continue;
      }
      unique.set(item.id, item);
    }

    const results = [...unique.values()].slice(0, options.limit ?? 50);
    await Promise.all(
      results.map(async (channel) => {
        if (!channel.name) {
          channel.name = await this.resolveChannelName(options.workspace, channel.id);
        }
      })
    );

    return results;
  }

  async listDms(options: BaseListOptions): Promise<SlackConversation[]> {
    const context = await this.bootstrapWorkspaceContext(options.workspace);
    const client = this.workspaceClient(options.workspace);

    const dmsRaw = await client.postForm("/api/client.dms", {
      ...toCommonForm(context),
      count: options.limit ?? 30,
      include_closed: false,
      include_channel: true,
      exclude_bots: false,
      priority_mode: "priority"
    });
    const dms = parseJson<DmsResponse>(dmsRaw.body);
    assertOk(dms, "client.dms");

    const rows: SlackConversation[] = (dms.dms ?? [])
      .map((dm) => ({
        id: dm.id || "",
        user: dm.user,
        latestTs: dm.latest?.ts
      }))
      .filter((dm) => Boolean(dm.id));

    await Promise.all(
      rows.map(async (dm) => {
        dm.userName = await this.resolveUserName(options.workspace, dm.user);
      })
    );

    return rows;
  }

  async getHistory(options: HistoryOptions): Promise<HistoryResult> {
    const context = await this.bootstrapWorkspaceContext(options.workspace);
    const client = this.workspaceClient(options.workspace);

    const responseRaw = await client.postForm("/api/conversations.history", {
      ...toCommonForm(context),
      channel: options.channel,
      limit: options.limit ?? 30,
      oldest: options.oldest,
      inclusive: true,
      ignore_replies: false,
      cursor: options.cursor
    });
    const response = parseJson<HistoryResponse>(responseRaw.body);
    assertOk(response, "conversations.history");

    const messages: SlackMessage[] = (response.messages ?? [])
      .map((message) => ({
        ts: message.ts || "",
        user: message.user,
        text: repairMojibakeText(message.text),
        threadTs: message.thread_ts,
        replyCount: message.reply_count
      }))
      .filter((message) => Boolean(message.ts));

    await Promise.all(
      messages.map(async (message) => {
        message.userName = await this.resolveUserName(options.workspace, message.user);
      })
    );

    return {
      messages,
      hasMore: Boolean(response.has_more || response.response_metadata?.next_cursor),
      nextCursor: response.response_metadata?.next_cursor
    };
  }

  async getReplies(options: RepliesOptions): Promise<HistoryResult> {
    const context = await this.bootstrapWorkspaceContext(options.workspace);
    const client = this.workspaceClient(options.workspace);

    const responseRaw = await client.postForm("/api/conversations.replies", {
      ...toCommonForm(context),
      channel: options.channel,
      ts: options.threadTs,
      limit: options.limit ?? 30,
      inclusive: true,
      cursor: options.cursor
    });
    const response = parseJson<HistoryResponse>(responseRaw.body);
    assertOk(response, "conversations.replies");

    const messages: SlackMessage[] = (response.messages ?? [])
      .map((message) => ({
        ts: message.ts || "",
        user: message.user,
        text: repairMojibakeText(message.text),
        threadTs: message.thread_ts,
        replyCount: message.reply_count
      }))
      .filter((message) => Boolean(message.ts));

    await Promise.all(
      messages.map(async (message) => {
        message.userName = await this.resolveUserName(options.workspace, message.user);
      })
    );

    return {
      messages,
      hasMore: Boolean(response.has_more || response.response_metadata?.next_cursor),
      nextCursor: response.response_metadata?.next_cursor
    };
  }
}

