import fs from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { DEFAULT_BASE_URL } from "../config.js";
import { saveAuthState, sessionFilePath } from "../state/auth-store.js";
import type { AuthState, CookieRecord, ImportResult } from "../types/auth.js";

interface SessionImportOptions {
  file?: string;
  json?: string;
  header?: string;
  baseUrl?: string;
  account?: string;
  setActive?: boolean;
}

interface BrowserCookieLike {
  name?: string;
  value?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
}

const REQUIRED_COOKIE_NAMES = ["d", "x", "xoxd"];

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function isSlackDomain(domain: string): boolean {
  return domain.toLowerCase().includes("slack.com");
}

function normalizeDomain(domain: string): string {
  if (!domain) {
    return ".slack.com";
  }
  return domain.startsWith(".") ? domain : `.${domain}`;
}

function parseCookieHeader(header: string): CookieRecord[] {
  const entries = header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index <= 0) {
        return null;
      }
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!name || !value) {
        return null;
      }
      return {
        name,
        value,
        domain: ".slack.com",
        path: "/",
        secure: true,
        httpOnly: false
      } as CookieRecord;
    })
    .filter((cookie): cookie is CookieRecord => cookie !== null);

  return dedupeCookies(entries);
}

function parseCookieJson(raw: string): CookieRecord[] {
  const parsed = JSON.parse(raw) as BrowserCookieLike[];
  if (!Array.isArray(parsed)) {
    throw new Error("Cookie JSON must be an array");
  }

  const records = parsed
    .filter((cookie) => cookie.name && cookie.value)
    .map((cookie) => ({
      name: String(cookie.name),
      value: String(cookie.value),
      domain: normalizeDomain(String(cookie.domain || "slack.com")),
      path: String(cookie.path || "/"),
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      expires:
        typeof cookie.expirationDate === "number"
          ? new Date(cookie.expirationDate * 1000).toISOString()
          : undefined
    } satisfies CookieRecord));

  return dedupeCookies(records);
}

function dedupeCookies(cookies: CookieRecord[]): CookieRecord[] {
  const map = new Map<string, CookieRecord>();
  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
    map.set(key, cookie);
  }
  return [...map.values()];
}

function validateCookies(cookies: CookieRecord[]): void {
  if (cookies.length === 0) {
    throw new Error("No cookies parsed from input");
  }

  const nonSlackCookies = cookies.filter((cookie) => !isSlackDomain(cookie.domain));
  if (nonSlackCookies.length > 0) {
    throw new Error("Found non-Slack domains in cookies. Please export only Slack cookies.");
  }

  const names = cookies.map((cookie) => cookie.name.toLowerCase());
  const hasRequiredName = REQUIRED_COOKIE_NAMES.some((requiredName) => names.includes(requiredName));
  if (!hasRequiredName) {
    throw new Error("Missing likely Slack session cookies (expected one of: d, x, xoxd).");
  }
}

async function promptForInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

async function resolveCookies(options: SessionImportOptions): Promise<{ sourceType: AuthState["sourceType"]; cookies: CookieRecord[] }> {
  if (options.header) {
    return { sourceType: "cookie-header", cookies: parseCookieHeader(options.header) };
  }

  if (options.json) {
    return { sourceType: "cookie-json", cookies: parseCookieJson(options.json) };
  }

  if (options.file) {
    const raw = await fs.readFile(options.file, "utf8");
    return { sourceType: "cookie-json", cookies: parseCookieJson(raw) };
  }

  const mode = (await promptForInput("Import mode ([h]eader/[j]son): ")).toLowerCase();
  if (mode.startsWith("h")) {
    const header = await promptForInput("Paste Cookie header value: ");
    return { sourceType: "cookie-header", cookies: parseCookieHeader(header) };
  }

  const jsonOrPath = await promptForInput("Paste cookie JSON array or file path: ");
  if (jsonOrPath.startsWith("[")) {
    return { sourceType: "cookie-json", cookies: parseCookieJson(jsonOrPath) };
  }

  const raw = await fs.readFile(jsonOrPath, "utf8");
  return { sourceType: "cookie-json", cookies: parseCookieJson(raw) };
}

function inferWorkspaceHints(cookies: CookieRecord[]): string[] {
  return unique(
    cookies
      .map((cookie) => cookie.domain.replace(/^\./, ""))
      .filter((domain) => domain !== "slack.com")
  );
}

export async function runSessionImport(options: SessionImportOptions): Promise<ImportResult> {
  const { sourceType, cookies } = await resolveCookies(options);
  validateCookies(cookies);

  const state: AuthState = {
    sourceType,
    importedAt: new Date().toISOString(),
    baseUrl: options.baseUrl || DEFAULT_BASE_URL,
    cookies,
    workspaceHints: inferWorkspaceHints(cookies)
  };

  await saveAuthState(state, options.account, { setActive: options.setActive !== false });

  const domains = unique(cookies.map((cookie) => cookie.domain));
  console.log(`Imported ${cookies.length} cookies across ${domains.length} domain(s).`);
  console.log(`Encrypted session saved to ${await sessionFilePath(options.account)}`);

  return { cookieCount: cookies.length, domains };
}
