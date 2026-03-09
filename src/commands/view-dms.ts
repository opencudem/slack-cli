import { SlackClient } from "../http/slack-client.js";
import { SlackWebApi } from "../http/slack-web-api.js";
import { printDms } from "../output/formatters.js";
import { loadAuthState, loadCookieJarFromState, persistCookieJarToState } from "../state/auth-store.js";

interface ViewDmsOptions {
  workspace: string;
  limit?: number;
  json?: boolean;
  account?: string;
}

export async function runViewDms(options: ViewDmsOptions): Promise<void> {
  const state = await loadAuthState(options.account);
  if (!state) {
    throw new Error("No saved session found. Run session:import first.");
  }

  const jar = await loadCookieJarFromState(options.account);
  const rootClient = new SlackClient({ baseUrl: state.baseUrl, cookieJar: jar });
  const api = new SlackWebApi(rootClient);
  const dms = await api.listDms({ workspace: options.workspace, limit: options.limit });

  if (options.json) {
    console.log(JSON.stringify(dms, null, 2));
  } else {
    printDms(dms);
  }

  await persistCookieJarToState(jar, options.account);
}
