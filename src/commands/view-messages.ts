import { SlackClient } from "../http/slack-client.js";
import { SlackWebApi } from "../http/slack-web-api.js";
import { printMessages } from "../output/formatters.js";
import { loadAuthState, loadCookieJarFromState, persistCookieJarToState } from "../state/auth-store.js";

interface ViewMessagesOptions {
  workspace: string;
  channel: string;
  limit?: number;
  oldest?: string;
  cursor?: string;
  json?: boolean;
  includeReplies?: boolean;
  account?: string;
}

export async function runViewMessages(options: ViewMessagesOptions): Promise<void> {
  const state = await loadAuthState(options.account);
  if (!state) {
    throw new Error("No saved session found. Run session:import first.");
  }

  const jar = await loadCookieJarFromState(options.account);
  const rootClient = new SlackClient({ baseUrl: state.baseUrl, cookieJar: jar });
  const api = new SlackWebApi(rootClient);
  const result = await api.getHistory({
    workspace: options.workspace,
    channel: options.channel,
    limit: options.limit,
    oldest: options.oldest,
    cursor: options.cursor
  });

  let messages = [...result.messages];
  if (options.includeReplies) {
    const seen = new Set(messages.map((message) => message.ts));

    for (const message of result.messages) {
      if ((message.replyCount ?? 0) <= 0) {
        continue;
      }

      const parentTs = message.threadTs || message.ts;
      let replyCursor: string | undefined;

      do {
        const replies = await api.getReplies({
          workspace: options.workspace,
          channel: options.channel,
          threadTs: parentTs,
          limit: 200,
          cursor: replyCursor
        });

        for (const reply of replies.messages) {
          if (reply.ts === parentTs || seen.has(reply.ts)) {
            continue;
          }
          seen.add(reply.ts);
          messages.push(reply);
        }

        replyCursor = replies.nextCursor;
      } while (replyCursor);
    }

    messages = messages.sort((a, b) => Number(a.ts) - Number(b.ts));
  }

  if (options.json) {
    console.log(JSON.stringify({ ...result, messages }, null, 2));
  } else {
    printMessages(messages);
    if (result.hasMore) {
      console.log("More messages are available.");
      if (result.nextCursor) {
        console.log(`Next cursor: ${result.nextCursor}`);
      }
      console.log("Use --cursor <value> for the next page.");
    }
  }

  await persistCookieJarToState(jar, options.account);
}
