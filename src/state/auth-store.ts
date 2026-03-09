import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Cookie, CookieJar } from "tough-cookie";
import {
  ACCOUNT_INDEX_FILE,
  accountSessionFile,
  APP_NAME,
  OUTPUT_DIR,
  SESSION_FILE,
  SESSIONS_DIR
} from "../config.js";
import type { AccountIndexState, AuthState, CookieRecord } from "../types/auth.js";

interface EncryptedPayload {
  iv: string;
  data: string;
}

const DEFAULT_ACCOUNT = "default";

function machineKey(): Buffer {
  const source = `${os.hostname()}|${os.userInfo().username}|${APP_NAME}`;
  return crypto.createHash("sha256").update(source).digest();
}

function encrypt(value: string): EncryptedPayload {
  const key = machineKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { iv: iv.toString("hex"), data: encrypted.toString("hex") };
}

function decrypt(payload: EncryptedPayload): string {
  const key = machineKey();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(payload.iv, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "hex")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function ensureSessionsDir(): Promise<void> {
  await ensureOutputDir();
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

function validateEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<EncryptedPayload>;
  return typeof candidate.iv === "string" && typeof candidate.data === "string";
}

function validateAuthState(value: unknown): value is AuthState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as Partial<AuthState>;
  return (
    typeof state.importedAt === "string" &&
    typeof state.baseUrl === "string" &&
    Array.isArray(state.cookies) &&
    (state.sourceType === "cookie-header" || state.sourceType === "cookie-json")
  );
}

function sanitizeAccountName(account?: string): string {
  const candidate = (account ?? "").trim();
  if (!candidate) {
    return DEFAULT_ACCOUNT;
  }

  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(candidate)) {
    throw new Error(
      "Invalid account name. Use 1-64 chars: letters, numbers, hyphen, underscore."
    );
  }
  return candidate.toLowerCase();
}

function uniqAccounts(accounts: string[]): string[] {
  const seen = new Set<string>();
  for (const account of accounts) {
    seen.add(sanitizeAccountName(account));
  }
  return [...seen];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeEncryptedAuthState(filePath: string, state: AuthState): Promise<void> {
  const payload = encrypt(JSON.stringify(state));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readEncryptedAuthState(filePath: string): Promise<AuthState | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as unknown;
    if (!validateEncryptedPayload(payload)) {
      return null;
    }
    const parsed = JSON.parse(decrypt(payload)) as unknown;
    return validateAuthState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readAccountIndex(): Promise<AccountIndexState | null> {
  try {
    const raw = await fs.readFile(ACCOUNT_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AccountIndexState>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const active = sanitizeAccountName(parsed.activeAccount);
    const entries = Array.isArray(parsed.accounts) ? parsed.accounts : [];
    const accountNames = uniqAccounts(
      entries
        .map((entry) => (entry && typeof entry.name === "string" ? entry.name : ""))
        .filter(Boolean)
        .concat(active)
    );
    const accounts = accountNames.map((name) => {
      const existing = entries.find((entry) => sanitizeAccountName(entry.name) === name);
      return {
        name,
        importedAt: existing?.importedAt || new Date().toISOString(),
        lastUsedAt: existing?.lastUsedAt
      };
    });
    return { activeAccount: active, accounts };
  } catch {
    return null;
  }
}

async function writeAccountIndex(state: AccountIndexState): Promise<void> {
  await ensureSessionsDir();
  const normalizedAccounts = uniqAccounts(state.accounts.map((entry) => entry.name));
  const accounts = normalizedAccounts.map((name) => {
    const existing = state.accounts.find((entry) => sanitizeAccountName(entry.name) === name);
    return {
      name,
      importedAt: existing?.importedAt || new Date().toISOString(),
      lastUsedAt: existing?.lastUsedAt
    };
  });
  const activeAccount = sanitizeAccountName(state.activeAccount || DEFAULT_ACCOUNT);
  if (!accounts.some((entry) => entry.name === activeAccount)) {
    accounts.unshift({
      name: activeAccount,
      importedAt: new Date().toISOString(),
      lastUsedAt: undefined
    });
  }
  await fs.writeFile(
    ACCOUNT_INDEX_FILE,
    `${JSON.stringify({ activeAccount, accounts }, null, 2)}\n`,
    "utf8"
  );
}

async function ensureMigratedLegacySession(): Promise<void> {
  const existingIndex = await readAccountIndex();
  if (existingIndex) {
    return;
  }

  const legacyState = await readEncryptedAuthState(SESSION_FILE);
  if (!legacyState) {
    return;
  }

  await ensureSessionsDir();
  const account = DEFAULT_ACCOUNT;
  await writeEncryptedAuthState(accountSessionFile(account), legacyState);
  await writeAccountIndex({
    activeAccount: account,
    accounts: [
      {
        name: account,
        importedAt: legacyState.importedAt,
        lastUsedAt: new Date().toISOString()
      }
    ]
  });
}

export async function saveAuthState(
  state: AuthState,
  account?: string,
  options: { setActive?: boolean } = {}
): Promise<void> {
  await ensureOutputDir();
  const accountName = sanitizeAccountName(account);
  await ensureSessionsDir();
  await writeEncryptedAuthState(accountSessionFile(accountName), state);

  const index = (await readAccountIndex()) ?? {
    activeAccount: accountName,
    accounts: []
  };
  const now = new Date().toISOString();
  const existing = index.accounts.find((entry) => sanitizeAccountName(entry.name) === accountName);
  const accounts = [
    ...index.accounts.filter((entry) => sanitizeAccountName(entry.name) !== accountName),
    {
      name: accountName,
      importedAt: existing?.importedAt || state.importedAt || now,
      lastUsedAt: now
    }
  ];
  await writeAccountIndex({
    activeAccount: options.setActive === false ? index.activeAccount : accountName,
    accounts
  });
}

async function resolveAccountName(account?: string): Promise<string> {
  const requested = sanitizeAccountName(account);
  if (account) {
    return requested;
  }

  await ensureMigratedLegacySession();
  const index = await readAccountIndex();
  if (!index) {
    return DEFAULT_ACCOUNT;
  }
  return sanitizeAccountName(index.activeAccount || DEFAULT_ACCOUNT);
}

export async function loadAuthState(account?: string): Promise<AuthState | null> {
  await ensureMigratedLegacySession();
  const accountName = await resolveAccountName(account);
  const state = await readEncryptedAuthState(accountSessionFile(accountName));
  if (state) {
    return state;
  }

  if (!account) {
    return readEncryptedAuthState(SESSION_FILE);
  }
  return null;
}

export async function listAccounts(): Promise<AccountIndexState> {
  await ensureMigratedLegacySession();
  const index = await readAccountIndex();
  if (index) {
    return index;
  }
  return {
    activeAccount: DEFAULT_ACCOUNT,
    accounts: []
  };
}

export async function setActiveAccount(account: string): Promise<void> {
  const accountName = sanitizeAccountName(account);
  await ensureMigratedLegacySession();
  const index = await listAccounts();
  if (!index.accounts.some((entry) => entry.name === accountName)) {
    throw new Error(`Account '${accountName}' not found.`);
  }
  const now = new Date().toISOString();
  await writeAccountIndex({
    activeAccount: accountName,
    accounts: index.accounts.map((entry) =>
      entry.name === accountName ? { ...entry, lastUsedAt: now } : entry
    )
  });
}

export async function removeAccount(account: string): Promise<void> {
  const accountName = sanitizeAccountName(account);
  await ensureMigratedLegacySession();
  const index = await listAccounts();
  if (!index.accounts.some((entry) => entry.name === accountName)) {
    return;
  }
  if (index.activeAccount === accountName) {
    throw new Error(
      "Cannot remove the active account. Run account:use to switch first."
    );
  }

  const filePath = accountSessionFile(accountName);
  if (await fileExists(filePath)) {
    await fs.unlink(filePath);
  }

  await writeAccountIndex({
    activeAccount: index.activeAccount,
    accounts: index.accounts.filter((entry) => entry.name !== accountName)
  });
}

function normalizeDomain(domain: string): string {
  if (!domain) {
    return ".slack.com";
  }
  return domain.startsWith(".") ? domain : `.${domain}`;
}

function toCookieRecord(cookie: Cookie): CookieRecord {
  return {
    name: cookie.key,
    value: cookie.value,
    domain: normalizeDomain(cookie.domain ?? ""),
    path: cookie.path ?? "/",
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    expires: cookie.expires && cookie.expires !== "Infinity" ? String(cookie.expires) : undefined
  };
}

function dedupeCookies(cookies: CookieRecord[]): CookieRecord[] {
  const map = new Map<string, CookieRecord>();
  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
    map.set(key, cookie);
  }
  return [...map.values()];
}

export async function createCookieJar(cookies: CookieRecord[]): Promise<CookieJar> {
  const jar = new CookieJar();
  for (const cookie of cookies) {
    const domain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
    const cookieLine = `${cookie.name}=${cookie.value}; Domain=${domain}; Path=${cookie.path || "/"}`;
    await jar.setCookie(cookieLine, `https://${domain}${cookie.path || "/"}`);
  }
  return jar;
}

export async function loadCookieJarFromState(account?: string): Promise<CookieJar> {
  const state = await loadAuthState(account);
  if (!state) {
    return new CookieJar();
  }
  return createCookieJar(state.cookies);
}

export async function exportJarCookies(jar: CookieJar): Promise<CookieRecord[]> {
  const serialized = await jar.serialize();
  const cookies = (serialized.cookies ?? []).map((cookie) =>
    toCookieRecord(Cookie.fromJSON(cookie) as Cookie)
  );
  return dedupeCookies(cookies.filter((cookie) => cookie.domain.includes("slack.com")));
}

export async function persistCookieJarToState(jar: CookieJar, account?: string): Promise<void> {
  const accountName = await resolveAccountName(account);
  const state = await loadAuthState(accountName);
  if (!state) {
    return;
  }
  const cookies = await exportJarCookies(jar);
  await saveAuthState(
    {
      ...state,
      cookies
    },
    accountName,
    { setActive: false }
  );
}

export async function sessionFilePath(account?: string): Promise<string> {
  const accountName = await resolveAccountName(account);
  return path.resolve(accountSessionFile(accountName));
}
