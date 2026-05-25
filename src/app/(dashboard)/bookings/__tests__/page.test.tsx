import { beforeEach, describe, expect, it, vi } from "vitest";

import BookingsPage from "../page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  createServerBackendClient: vi.fn(),
  bookingsOrder: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/backend/server", () => ({
  createServerBackendClient: mocks.createServerBackendClient,
}));

vi.mock("@/components/dashboard/bookings-client", () => ({
  default: ({ bookings }: { bookings: unknown[] }) => (
    <div data-testid="bookings-client">{bookings.length}</div>
  ),
}));

function createQueryBuilder(table: string) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => ({
      data: table === "profiles" ? { id: "profile-1" } : null,
    })),
    order: vi.fn(async (...args: unknown[]) => {
      if (table === "bookings") {
        mocks.bookingsOrder(...args);
      }

      return { data: [] };
    }),
  };

  return builder;
}

describe("BookingsPage", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.bookingsOrder.mockReset();
    mocks.createServerBackendClient.mockReset();
    mocks.createServerBackendClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "auth-user-1" } },
        })),
      },
      from: vi.fn((table: string) => createQueryBuilder(table)),
    });
  });

  it("loads dashboard bookings in chronological order", async () => {
    await BookingsPage();

    expect(mocks.bookingsOrder).toHaveBeenCalledWith("start_at", {
      ascending: true,
    });
  });
});
