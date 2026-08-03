import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { axe, toHaveNoViolations } from "jest-axe"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AvailabilityNoSchedulesState } from "../availability-no-schedules-state"

expect.extend(toHaveNoViolations)

const push = vi.hoisted(() => vi.fn())
const refresh = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast }),
}))

describe("AvailabilityNoSchedulesState", () => {
  beforeEach(() => {
    push.mockClear()
    refresh.mockClear()
    toast.mockClear()
    vi.unstubAllGlobals()
  })

  it("keeps the visible Availability heading in the empty state", async () => {
    const { container } = render(
      <AvailabilityNoSchedulesState timezone="America/Los_Angeles" />
    )

    const pageHeadings = screen.getAllByRole("heading", {
      level: 1,
      name: "Availability",
    })
    expect(pageHeadings).toHaveLength(1)
    expect(pageHeadings[0].classList.contains("sr-only")).toBe(false)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders a genuine empty state and creates a first schedule", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schedule: { id: "schedule-1", name: "Working hours" },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<AvailabilityNoSchedulesState timezone="America/Los_Angeles" />)

    expect(screen.getByText("No availability schedules")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }))

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/availability?scheduleId=schedule-1"
      )
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/availability/schedules",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Working hours",
          timezone: "America/Los_Angeles",
        }),
      })
    )
  })
})
