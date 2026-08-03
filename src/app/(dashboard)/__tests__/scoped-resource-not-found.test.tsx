import { beforeEach, describe, expect, it, vi } from "vitest"
import AvailabilityPage from "../availability/page"
import ContactPage from "../contacts/[id]/page"
import EditEventTypePage from "../event-types/[id]/edit/page"

interface QueryResult {
  data: unknown
  error: { code?: string; message: string; status?: number } | null
}

class QueryBuilderMock implements PromiseLike<QueryResult> {
  select = vi.fn((..._arguments: unknown[]) => this)
  eq = vi.fn((..._arguments: unknown[]) => this)
  is = vi.fn((..._arguments: unknown[]) => this)
  order = vi.fn((..._arguments: unknown[]) => this)
  single = vi.fn(async () => this.result)
  maybeSingle = vi.fn(async () => this.result)

  constructor(private readonly result: QueryResult) {}

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

const mocks = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  createServerBackendClient: vi.fn(),
  createAdminBackendClient: vi.fn(),
  loadDashboardCalendarConnections: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))

vi.mock("@/lib/backend/server", () => ({
  createServerBackendClient: mocks.createServerBackendClient,
  createAdminBackendClient: mocks.createAdminBackendClient,
}))

vi.mock("@/lib/dashboard/integration-load-state", () => ({
  loadDashboardCalendarConnections: mocks.loadDashboardCalendarConnections,
}))

vi.mock("@/components/dashboard/availability-client", () => ({
  AvailabilityClient: () => null,
}))

vi.mock("@/components/dashboard/availability-no-schedules-state", () => ({
  AvailabilityNoSchedulesState: () => null,
}))

vi.mock("@/components/dashboard/contact-profile-client", () => ({
  ContactProfileClient: () => null,
}))

function query(data: unknown, error: QueryResult["error"] = null) {
  return new QueryBuilderMock({ data, error })
}

function tableClient(tables: Record<string, QueryBuilderMock>) {
  return vi.fn((table: string) => {
    const builder = tables[table]
    if (!builder) {
      throw new Error(`Unexpected table query: ${table}`)
    }
    return builder
  })
}

function authenticatedClient(from: ReturnType<typeof tableClient>) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "auth-user-1", email: "host@example.com" } },
        error: null,
      })),
    },
    from,
  }
}

describe("scoped dashboard resources", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createServerBackendClient.mockReset()
    mocks.createAdminBackendClient.mockReset()
  })

  it("returns Not Found for a scheduleId outside the host's schedules", async () => {
    const profileQuery = query({
      id: "profile-1",
      default_timezone: "America/Los_Angeles",
    })
    const schedulesQuery = query([
      {
        id: "schedule-owned",
        name: "Working hours",
        timezone: "America/Los_Angeles",
        is_default: true,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ])
    const eventTypesQuery = query([])
    const from = tableClient({
      profiles: profileQuery,
      schedules: schedulesQuery,
      event_types: eventTypesQuery,
    })
    mocks.createServerBackendClient.mockResolvedValue(
      authenticatedClient(from)
    )

    await expect(
      AvailabilityPage({
        searchParams: Promise.resolve({ scheduleId: "schedule-other-host" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND")

    expect(schedulesQuery.eq).toHaveBeenCalledWith("user_id", "profile-1")
    expect(mocks.notFound).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalledWith("availability_rules")
  })

  it("returns Not Found when a scoped contact is absent", async () => {
    const profileQuery = query({ id: "profile-1" })
    const serverFrom = tableClient({ profiles: profileQuery })
    const contactQuery = query(null)
    const adminFrom = tableClient({ contacts: contactQuery })
    mocks.createServerBackendClient.mockResolvedValue(
      authenticatedClient(serverFrom)
    )
    mocks.createAdminBackendClient.mockReturnValue({ from: adminFrom })

    await expect(
      ContactPage({ params: Promise.resolve({ id: "contact-other-host" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND")

    expect(contactQuery.eq).toHaveBeenCalledWith("id", "contact-other-host")
    expect(contactQuery.eq).toHaveBeenCalledWith("host_user_id", "profile-1")
    expect(mocks.notFound).toHaveBeenCalledTimes(1)
    expect(adminFrom).not.toHaveBeenCalledWith("bookings")
  })

  it("returns Not Found when a scoped event type lookup returns no row", async () => {
    const profileQuery = query({
      id: "profile-1",
      name: "Host",
      username: "host",
      avatar_url: null,
    })
    const eventTypeQuery = query(null, {
      code: "PGRST116",
      message: "No rows returned",
      status: 404,
    })
    const from = tableClient({
      profiles: profileQuery,
      event_types: eventTypeQuery,
    })
    mocks.createServerBackendClient.mockResolvedValue(
      authenticatedClient(from)
    )

    await expect(
      EditEventTypePage({
        params: Promise.resolve({ id: "event-type-other-host" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND")

    expect(eventTypeQuery.eq).toHaveBeenCalledWith(
      "id",
      "event-type-other-host"
    )
    expect(eventTypeQuery.eq).toHaveBeenCalledWith("user_id", "profile-1")
    expect(mocks.notFound).toHaveBeenCalledTimes(1)
    expect(mocks.createAdminBackendClient).not.toHaveBeenCalled()
    expect(mocks.loadDashboardCalendarConnections).not.toHaveBeenCalled()
  })
})
