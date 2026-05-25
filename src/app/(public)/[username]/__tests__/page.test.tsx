import { beforeEach, describe, expect, it, vi } from "vitest";

import PublicProfilePage from "../page";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  createAdminBackendClient: vi.fn(),
  eventTypesOrder: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/backend/server", () => ({
  createAdminBackendClient: mocks.createAdminBackendClient,
}));

vi.mock("../profile-content", () => ({
  PublicProfileContent: ({
    activeEventTypes,
  }: {
    activeEventTypes: unknown[];
  }) => <div data-testid="public-profile">{activeEventTypes.length}</div>,
}));

function createQueryBuilder(table: string) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => ({
      data:
        table === "profiles"
          ? {
              id: "profile-1",
              name: "Sarah Chen",
              username: "sarah",
              avatar_url: null,
              default_timezone: "America/Los_Angeles",
              public_headline: null,
              public_bio: null,
              response_time_label: null,
            }
          : null,
      error: null,
    })),
    order: vi.fn(async (...args: unknown[]) => {
      if (table === "event_types") {
        mocks.eventTypesOrder(...args);
      }

      return { data: [], error: null };
    }),
  };

  return builder;
}

describe("PublicProfilePage", () => {
  beforeEach(() => {
    mocks.notFound.mockClear();
    mocks.eventTypesOrder.mockReset();
    mocks.createAdminBackendClient.mockReset();
    mocks.createAdminBackendClient.mockReturnValue({
      from: vi.fn((table: string) => createQueryBuilder(table)),
    });
  });

  it("loads public event types in a stable newest-first order", async () => {
    await PublicProfilePage({
      params: Promise.resolve({ username: "sarah" }),
    });

    expect(mocks.eventTypesOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });
});
