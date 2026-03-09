import { SESSION_CHECK_PATH } from "../config.js";
import { SlackClient } from "../http/slack-client.js";
import {
  loadAuthState,
  loadCookieJarFromState,
  persistCookieJarToState
} from "../state/auth-store.js";

interface SessionCheckOptions {
  account?: string;
}

export async function runSessionCheck(options: SessionCheckOptions = {}): Promise<void> {
  const state = await loadAuthState(options.account);
  if (!state) {
    console.log("No saved session found. Run session:import first.");
    return;
  }

  const jar = await loadCookieJarFromState(options.account);
  const client = new SlackClient({ baseUrl: state.baseUrl, cookieJar: jar });
  const response = await client.get(SESSION_CHECK_PATH);

  const looksAuthenticated =
    response.statusCode >= 200 &&
    response.statusCode < 400 &&
    !response.body.toLowerCase().includes("sign in");

  if (looksAuthenticated) {
    console.log("Session appears valid.");
    console.log(`Status: ${response.statusCode}`);
  } else {
    console.log("Session appears invalid or expired.");
    console.log(`Status: ${response.statusCode}`);
  }

  await persistCookieJarToState(jar, options.account);
}
