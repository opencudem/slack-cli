import { WORKSPACE_LIST_PATH } from "../config.js";
import { SlackClient } from "../http/slack-client.js";
import { loadAuthState, loadCookieJarFromState } from "../state/auth-store.js";

function toSlackDomain(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return null;
  }

  const withoutProtocol = value.replace(/^https?:\/\//, "");
  const hostnameOnly = withoutProtocol.split("/")[0];
  const withoutSuffix = hostnameOnly.endsWith(".slack.com")
    ? hostnameOnly.slice(0, -".slack.com".length)
    : hostnameOnly;

  if (!withoutSuffix || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(withoutSuffix)) {
    return null;
  }
  return `${withoutSuffix}.slack.com`;
}

function extractWorkspaceTokens(body: string): string[] {
  const fromStructuredKeys = [
    ...body.matchAll(/"team_domain"\s*:\s*"([a-z0-9.-]+)"/gi),
    ...body.matchAll(/"workspace_domain"\s*:\s*"([a-z0-9.-]+)"/gi),
    ...body.matchAll(/"domain"\s*:\s*"([a-z0-9.-]+)"/gi)
  ]
    .map((match) => toSlackDomain(match[1]))
    .filter((domain): domain is string => Boolean(domain));

  const fromUrlHints = [
    ...body.matchAll(/https:\/\/([a-z0-9.-]+)\.slack\.com\/client/gi),
    ...body.matchAll(/\/client\/T[A-Z0-9]+\/([a-z0-9.-]+)/gi)
  ]
    .map((match) => toSlackDomain(match[1]))
    .filter((domain): domain is string => Boolean(domain));

  const candidateDomains = [...fromStructuredKeys, ...fromUrlHints];
  const blocked = new Set(["api.slack.com", "app.slack.com", "dev.slack.com", "my.slack.com"]);
  const filtered = candidateDomains.filter((domain) => !blocked.has(domain));
  const unique = [...new Set(filtered)];

  // Fallback for unexpected payload shapes.
  if (unique.length > 0) {
    return unique.slice(0, 20);
  }

  const broadMatches = [...body.matchAll(/([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.slack\.com/gi)];
  return [
    ...new Set(
      broadMatches
        .map((match) => toSlackDomain(match[1]))
        .filter((domain): domain is string => Boolean(domain))
    )
  ]
    .filter((domain) => !blocked.has(domain))
    .slice(0, 20);
}

interface WorkspaceListOptions {
  account?: string;
}

export async function runWorkspaceList(options: WorkspaceListOptions = {}): Promise<void> {
  const state = await loadAuthState(options.account);
  if (!state) {
    console.log("No saved session found. Run session:import first.");
    return;
  }

  const jar = await loadCookieJarFromState(options.account);
  const client = new SlackClient({ baseUrl: state.baseUrl, cookieJar: jar });
  const response = await client.get(WORKSPACE_LIST_PATH);
  const discovered = extractWorkspaceTokens(response.body);

  if (discovered.length === 0) {
    console.log("No workspace domains discovered from response.");
    if (state.workspaceHints?.length) {
      console.log(`Stored hints: ${state.workspaceHints.join(", ")}`);
    }
    return;
  }

  console.log("Discovered workspace domains:");
  for (const workspace of discovered) {
    console.log(`- ${workspace}`);
  }
}
