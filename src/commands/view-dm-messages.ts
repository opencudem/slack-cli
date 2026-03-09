import { runViewMessages } from "./view-messages.js";

interface ViewDmMessagesOptions {
  workspace: string;
  dm: string;
  limit?: number;
  oldest?: string;
  cursor?: string;
  json?: boolean;
  includeReplies?: boolean;
  account?: string;
}

export async function runViewDmMessages(options: ViewDmMessagesOptions): Promise<void> {
  await runViewMessages({
    workspace: options.workspace,
    channel: options.dm,
    limit: options.limit,
    oldest: options.oldest,
    cursor: options.cursor,
    json: options.json,
    includeReplies: options.includeReplies,
    account: options.account
  });
}
