import { SlackClient } from "../http/slack-client.js";
import { SlackWebApi } from "../http/slack-web-api.js";
import { printThreads } from "../output/formatters.js";
import { loadAuthState, loadCookieJarFromState, persistCookieJarToState } from "../state/auth-store.js";

interface ViewThreadsOptions {
  workspace: string;
  channel: string;
  threadTs: string;
  limit?: number;
  cursor?: string;
  json?: boolean;
  account?: string;
}

export async function runViewThreads(options: ViewThreadsOptions): Promise<void> {
  const state = await loadAuthState(options.account);
  if (!state) {
    throw new Error("No saved session found. Run session:import first.");
  }

  const jar = await loadCookieJarFromState(options.account);
  const rootClient = new SlackClient({ baseUrl: state.baseUrl, cookieJar: jar });
  const api = new SlackWebApi(rootClient);
  const result = await api.getReplies({
    workspace: options.workspace,
    channel: options.channel,
    threadTs: options.threadTs,
    limit: options.limit,
    cursor: options.cursor
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printThreads(result.messages);
    if (result.hasMore) {
      console.log("More replies are available.");
      if (result.nextCursor) {
        console.log(`Next cursor: ${result.nextCursor}`);
      }
      console.log("Use --cursor <value> for the next page.");
    }
  }

  await persistCookieJarToState(jar, options.account);
}
