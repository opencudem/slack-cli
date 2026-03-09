import {
  DEFAULT_X_APP_NAME,
  DEFAULT_X_MODE,
  DEFAULT_X_SONIC
} from "../config.js";
import type { WorkspaceContext } from "../types/auth.js";

export function normalizeWorkspace(workspaceInput: string): string {
  const raw = workspaceInput.trim().toLowerCase();
  if (!raw) {
    throw new Error("Workspace is required.");
  }

  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  const hostnameOnly = withoutProtocol.split("/")[0];
  const withoutSuffix = hostnameOnly.endsWith(".slack.com")
    ? hostnameOnly.slice(0, -".slack.com".length)
    : hostnameOnly;

  if (!withoutSuffix || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(withoutSuffix)) {
    throw new Error(
      "Invalid workspace value. Use a workspace slug like 'team', or domain like 'team.slack.com' or 'team.enterprise.slack.com'."
    );
  }
  return withoutSuffix;
}

function extractWithRegex(body: string, regexes: RegExp[]): string | undefined {
  for (const regex of regexes) {
    const match = body.match(regex);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

export function parseWorkspaceContextFromBody(workspace: string, body: string): WorkspaceContext {
  const normalizedWorkspace = normalizeWorkspace(workspace);
  const token = extractWithRegex(body, [
    /"api_token"\s*:\s*"([^"]+)"/,
    /"token"\s*:\s*"(xox[cabop]-[^"]+)"/,
    /api_token\\u0022:\\u0022([^\\]+)\\u0022/
  ]);

  const xMode = extractWithRegex(body, [/"_x_mode"\s*:\s*"([^"]+)"/]) ?? DEFAULT_X_MODE;
  const xSonic = extractWithRegex(body, [/"_x_sonic"\s*:\s*"([^"]+)"/]) ?? DEFAULT_X_SONIC;
  const xAppName =
    extractWithRegex(body, [/"_x_app_name"\s*:\s*"([^"]+)"/]) ?? DEFAULT_X_APP_NAME;

  return {
    workspace: normalizedWorkspace,
    baseUrl: `https://${normalizedWorkspace}.slack.com`,
    token,
    xMode,
    xSonic,
    xAppName
  };
}
