import { SlackClient } from "../http/slack-client.js";
import { SlackWebApi } from "../http/slack-web-api.js";
import { printChannels } from "../output/formatters.js";
import { loadAuthState, loadCookieJarFromState, persistCookieJarToState } from "../state/auth-store.js";

interface ViewChannelsOptions {
  workspace: string;
  limit?: number;
  json?: boolean;
  account?: string;
}

export async function runViewChannels(options: ViewChannelsOptions): Promise<void> {
  const state = await loadAuthState(options.account);
  if (!state) {
    throw new Error("No saved session found. Run session:import first.");
  }

  const jar = await loadCookieJarFromState(options.account);
  const rootClient = new SlackClient({ baseUrl: state.baseUrl, cookieJar: jar });
  const api = new SlackWebApi(rootClient);
  const channels = await api.listChannels({ workspace: options.workspace, limit: options.limit });

  if (options.json) {
    console.log(JSON.stringify(channels, null, 2));
  } else {
    printChannels(channels);
  }

  await persistCookieJarToState(jar, options.account);
}
