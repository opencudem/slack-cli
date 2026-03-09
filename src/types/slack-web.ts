export interface SlackConversation {
  id: string;
  name?: string;
  user?: string;
  userName?: string;
  latestTs?: string;
  unreadCount?: number;
}

export interface SlackMessage {
  ts: string;
  user?: string;
  userName?: string;
  text?: string;
  threadTs?: string;
  replyCount?: number;
}

export interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

export interface UserBootResponse extends SlackApiResponse {
  token?: string;
  api_token?: string;
}

export interface ChannelSectionsResponse extends SlackApiResponse {
  channel_sections?: Array<{ channel_ids?: string[] }>;
}

export interface CountsResponse extends SlackApiResponse {
  channels?: Array<{
    id?: string;
    name?: string;
    unread_count?: number;
    latest?: { ts?: string };
  }>;
}

export interface DmsResponse extends SlackApiResponse {
  dms?: Array<{
    id?: string;
    user?: string;
    latest?: { ts?: string; text?: string; user?: string };
  }>;
}

export interface HistoryResponse extends SlackApiResponse {
  messages?: Array<{
    ts?: string;
    text?: string;
    user?: string;
    thread_ts?: string;
    reply_count?: number;
  }>;
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
}

export interface UsersInfoResponse extends SlackApiResponse {
  user?: {
    id?: string;
    name?: string;
    real_name?: string;
    profile?: {
      display_name?: string;
      real_name?: string;
    };
  };
}

export interface ConversationsInfoResponse extends SlackApiResponse {
  channel?: {
    id?: string;
    name?: string;
  };
}
