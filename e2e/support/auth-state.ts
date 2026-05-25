import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BACKEND_ACCESS_TOKEN_COOKIE,
  BACKEND_REFRESH_TOKEN_COOKIE,
  backendSessionCookies as buildBackendSessionCookies,
} from "@/lib/backend/session";

type BackendSessionCookieInput = Parameters<typeof buildBackendSessionCookies>[0];

export type StoredBrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

export type DemoHostAuthState = {
  cookies: StoredBrowserCookie[];
  origins: unknown[];
};

const backendSessionCookieNames = new Set([
  BACKEND_ACCESS_TOKEN_COOKIE,
  BACKEND_REFRESH_TOKEN_COOKIE,
]);

export function saveDemoHostSessionState(
  session: BackendSessionCookieInput,
  baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) {
  writeDemoHostAuthState({
    cookies: buildBackendSessionCookies(session, true).map((cookie) =>
      toStoredBrowserCookie(cookie, baseURL)
    ),
    origins: [],
  });
}

export function readDemoHostAuthState(): DemoHostAuthState | null {
  const filePath = demoHostAuthStatePath();
  if (!existsSync(filePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      cookies?: unknown;
      origins?: unknown;
    };

    return {
      cookies: Array.isArray(parsed.cookies)
        ? (parsed.cookies as StoredBrowserCookie[])
        : [],
      origins: Array.isArray(parsed.origins) ? parsed.origins : [],
    };
  } catch {
    return null;
  }
}

export function writeDemoHostAuthState(state: DemoHostAuthState) {
  const filePath = demoHostAuthStatePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function mergeStoredBackendCookies(
  nextState: DemoHostAuthState
): DemoHostAuthState {
  if (hasBackendAuthCookie(nextState)) return nextState;

  const existingState = readDemoHostAuthState();
  if (!existingState || !hasBackendAuthCookie(existingState)) {
    return nextState;
  }

  return {
    ...nextState,
    cookies: [
      ...nextState.cookies.filter((cookie) => !isBackendSessionCookie(cookie)),
      ...existingState.cookies.filter(isBackendSessionCookie),
    ],
  };
}

export function hasBackendAuthCookie(state: DemoHostAuthState) {
  return state.cookies.some(
    (cookie) => cookie.name === BACKEND_ACCESS_TOKEN_COOKIE && cookie.value
  );
}

export function demoHostAuthStatePath() {
  return (
    process.env.E2E_DEMO_AUTH_STATE_FILE ??
    path.join(process.cwd(), "test-results", "e2e-demo-auth-state.json")
  );
}

function isBackendSessionCookie(cookie: StoredBrowserCookie) {
  return backendSessionCookieNames.has(cookie.name);
}

function toStoredBrowserCookie(
  cookie: ReturnType<typeof buildBackendSessionCookies>[number],
  baseURL: string
): StoredBrowserCookie {
  const url = new URL(baseURL);
  const maxAge = cookie.options.maxAge;

  return {
    name: cookie.name,
    value: cookie.value,
    domain: url.hostname,
    path: cookie.options.path ?? "/",
    expires:
      typeof maxAge === "number"
        ? Math.floor(Date.now() / 1000) + maxAge
        : -1,
    httpOnly: cookie.options.httpOnly ?? false,
    secure: cookie.options.secure ?? url.protocol === "https:",
    sameSite: toStoredSameSite(cookie.options.sameSite),
  };
}

function toStoredSameSite(
  sameSite: ReturnType<typeof buildBackendSessionCookies>[number]["options"]["sameSite"]
) {
  if (sameSite === "strict") return "Strict";
  if (sameSite === "none") return "None";
  return "Lax";
}
