export interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
  expires?: string;
}

export interface AuthState {
  sourceType: "cookie-header" | "cookie-json";
  importedAt: string;
  baseUrl: string;
  cookies: CookieRecord[];
  workspaceHints?: string[];
}

export interface AccountEntry {
  name: string;
  importedAt: string;
  lastUsedAt?: string;
}

export interface AccountIndexState {
  activeAccount: string;
  accounts: AccountEntry[];
}

export interface ImportResult {
  cookieCount: number;
  domains: string[];
}

export interface WorkspaceContext {
  workspace: string;
  baseUrl: string;
  token?: string;
  xMode: string;
  xSonic: string;
  xAppName: string;
}
