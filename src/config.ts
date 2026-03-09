import path from "node:path";

export const APP_NAME = "slack-cli";
export const OUTPUT_DIR = path.resolve("output");
export const SESSION_FILE = path.join(OUTPUT_DIR, "session.enc.json");
export const SESSIONS_DIR = path.join(OUTPUT_DIR, "sessions");
export const ACCOUNT_INDEX_FILE = path.join(SESSIONS_DIR, "index.json");
export const DEFAULT_BASE_URL = "https://app.slack.com";
export const SESSION_CHECK_PATH = "/client";
export const WORKSPACE_LIST_PATH = "/sign_in_with_password";
export const REQUEST_TIMEOUT_MS = 20000;

export const DEFAULT_X_MODE = "online";
export const DEFAULT_X_SONIC = "1";
export const DEFAULT_X_APP_NAME = "client";

export function accountSessionFile(account: string): string {
  return path.join(SESSIONS_DIR, `${account}.enc.json`);
}
