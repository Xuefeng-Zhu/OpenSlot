import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasBackendAuthCookie,
  mergeStoredBackendCookies,
  readDemoHostBackendSessionTokens,
  readDemoHostAuthState,
  saveDemoHostSessionState,
  writeDemoHostAuthState,
} from "../../../e2e/support/auth-state";

describe("E2E demo auth state", () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(path.join(tmpdir(), "openslot-e2e-auth-"));
    vi.stubEnv(
      "E2E_DEMO_AUTH_STATE_FILE",
      path.join(runtimeDir, "auth-state.json")
    );
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://127.0.0.1:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it("writes backend session cookies that Playwright can restore", () => {
    saveDemoHostSessionState({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600,
      user: { id: "auth-user-1", email: "demo@example.com" },
    });

    const state = readDemoHostAuthState();

    expect(state).not.toBeNull();
    expect(hasBackendAuthCookie(state!)).toBe(true);
    expect(state!.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "127.0.0.1",
          httpOnly: true,
          name: "openslot_backend_access_token",
          sameSite: "Lax",
          secure: false,
          value: "access-token",
        }),
        expect.objectContaining({
          httpOnly: true,
          name: "openslot_backend_refresh_token",
          value: "refresh-token",
        }),
        expect.objectContaining({
          httpOnly: false,
          name: "openslot_auth_session_persistence",
        }),
      ])
    );
  });

  it("preserves seeded backend cookies when browser storage omits them", () => {
    writeDemoHostAuthState({
      cookies: [
        {
          domain: "127.0.0.1",
          expires: 1770000000,
          httpOnly: true,
          name: "openslot_backend_access_token",
          path: "/",
          sameSite: "Lax",
          secure: false,
          value: "seeded-access-token",
        },
        {
          domain: "127.0.0.1",
          expires: 1770000000,
          httpOnly: true,
          name: "openslot_backend_refresh_token",
          path: "/",
          sameSite: "Lax",
          secure: false,
          value: "seeded-refresh-token",
        },
      ],
      origins: [],
    });

    const merged = mergeStoredBackendCookies({
      cookies: [
        {
          domain: "127.0.0.1",
          expires: 1770000000,
          httpOnly: false,
          name: "openslot_auth_session_persistence",
          path: "/",
          sameSite: "Lax",
          secure: false,
          value: "persistent",
        },
      ],
      origins: [],
    });

    expect(merged.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "openslot_backend_access_token",
          value: "seeded-access-token",
        }),
        expect.objectContaining({
          name: "openslot_backend_refresh_token",
          value: "seeded-refresh-token",
        }),
        expect.objectContaining({
          name: "openslot_auth_session_persistence",
          value: "persistent",
        }),
      ])
    );
  });

  it("reads saved backend session tokens for global setup reuse", () => {
    saveDemoHostSessionState({
      accessToken: "cached-access-token",
      refreshToken: "cached-refresh-token",
      expiresIn: 3600,
      user: { id: "auth-user-1", email: "demo@example.com" },
    });

    expect(readDemoHostBackendSessionTokens()).toEqual({
      accessToken: "cached-access-token",
      refreshToken: "cached-refresh-token",
    });
  });

  it("treats refresh-token-only state as restorable", () => {
    writeDemoHostAuthState({
      cookies: [
        {
          domain: "127.0.0.1",
          expires: 1770000000,
          httpOnly: true,
          name: "openslot_backend_refresh_token",
          path: "/",
          sameSite: "Lax",
          secure: false,
          value: "cached-refresh-token",
        },
      ],
      origins: [],
    });

    const state = readDemoHostAuthState();

    expect(state).not.toBeNull();
    expect(hasBackendAuthCookie(state!)).toBe(true);
    expect(readDemoHostBackendSessionTokens()).toEqual({
      refreshToken: "cached-refresh-token",
    });
  });
});
