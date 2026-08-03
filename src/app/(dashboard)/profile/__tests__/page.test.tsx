import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "../page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  createServerBackendClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/backend/server", () => ({
  createServerBackendClient: mocks.createServerBackendClient,
}));

function createClient({
  user,
  profile,
  authError = null,
  profileError = null,
}: {
  user: { id: string } | null;
  profile: unknown;
  authError?: unknown;
  profileError?: unknown;
}) {
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    single: vi.fn(async () => ({ data: profile, error: profileError })),
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: authError })),
    },
    from: vi.fn(() => profileQuery),
  };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.createServerBackendClient.mockReset();
  });

  it("redirects unauthenticated users to login", async () => {
    mocks.createServerBackendClient.mockResolvedValue(
      createClient({ user: null, profile: null })
    );

    await expect(ProfilePage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users without a profile to onboarding", async () => {
    mocks.createServerBackendClient.mockResolvedValue(
      createClient({ user: { id: "auth-user-1" }, profile: null })
    );

    await expect(ProfilePage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("redirects an explicit missing-row profile response to onboarding", async () => {
    mocks.createServerBackendClient.mockResolvedValue(
      createClient({
        user: { id: "auth-user-1" },
        profile: null,
        profileError: { code: "PGRST116", message: "No rows" },
      })
    );

    await expect(ProfilePage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });

  it("throws a real profile query failure instead of redirecting", async () => {
    mocks.createServerBackendClient.mockResolvedValue(
      createClient({
        user: { id: "auth-user-1" },
        profile: null,
        profileError: { status: 500, message: "database unavailable" },
      })
    );

    await expect(ProfilePage()).rejects.toThrow("Failed to load dashboard profile");
    expect(mocks.redirect).not.toHaveBeenCalledWith("/onboarding");
  });

  it("throws a provider auth failure instead of redirecting to login", async () => {
    mocks.createServerBackendClient.mockResolvedValue(
      createClient({
        user: null,
        profile: null,
        authError: { status: 503, message: "auth unavailable" },
      })
    );

    await expect(ProfilePage()).rejects.toThrow(
      "Failed to verify the authenticated session"
    );
    expect(mocks.redirect).not.toHaveBeenCalledWith("/login");
  });
});
