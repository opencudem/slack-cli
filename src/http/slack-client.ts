import { CookieJar } from "tough-cookie";
import { request } from "undici";
import { DEFAULT_BASE_URL, REQUEST_TIMEOUT_MS } from "../config.js";

export interface SlackClientOptions {
  baseUrl?: string;
  cookieJar: CookieJar;
  retries?: number;
}

export interface SlackResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string | string[]>;
  url: string;
}

export interface SlackRequestOptions {
  headers?: Record<string, string>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractSetCookieValues(headers: Record<string, string | string[] | undefined>): string[] {
  const setCookieHeader = headers["set-cookie"];
  if (!setCookieHeader) {
    return [];
  }
  return Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
}

export class SlackClient {
  private readonly baseUrl: string;
  private readonly cookieJar: CookieJar;
  private readonly retries: number;

  constructor(options: SlackClientOptions) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.cookieJar = options.cookieJar;
    this.retries = options.retries ?? 2;
  }

  getCookieJar(): CookieJar {
    return this.cookieJar;
  }

  async get(pathname: string, options?: SlackRequestOptions): Promise<SlackResponse> {
    return this.performRequest("GET", pathname, undefined, options);
  }

  async postForm(
    pathname: string,
    form: Record<string, string | number | boolean | undefined>,
    options?: SlackRequestOptions
  ): Promise<SlackResponse> {
    const encoded = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      if (value === undefined) {
        continue;
      }
      encoded.set(key, String(value));
    }

    return this.performRequest("POST", pathname, encoded.toString(), {
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...(options?.headers ?? {})
      }
    });
  }

  private async performRequest(
    method: "GET" | "POST",
    pathname: string,
    body?: string,
    options?: SlackRequestOptions
  ): Promise<SlackResponse> {
    const url = new URL(pathname, this.baseUrl).toString();
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.retries) {
      try {
        const cookieHeader = await this.cookieJar.getCookieString(url);
        const response = await request(url, {
          method,
          body,
          headers: {
            "user-agent": "slack-cli/0.2",
            accept: "application/json,text/plain;q=0.9,text/html;q=0.8,*/*;q=0.7",
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
            ...(options?.headers ?? {})
          },
          headersTimeout: REQUEST_TIMEOUT_MS,
          bodyTimeout: REQUEST_TIMEOUT_MS
        });

        for (const setCookieValue of extractSetCookieValues(response.headers)) {
          await this.cookieJar.setCookie(setCookieValue, url);
        }

        const responseBody = await response.body.text();
        return {
          statusCode: response.statusCode,
          body: responseBody,
          headers: response.headers as Record<string, string | string[]>,
          url
        };
      } catch (error) {
        lastError = error;
        if (attempt === this.retries) {
          break;
        }
        const backoffMs = 250 * Math.pow(2, attempt);
        await sleep(backoffMs);
      }
      attempt += 1;
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Slack request failed after ${this.retries + 1} attempts: ${message}`);
  }
}
