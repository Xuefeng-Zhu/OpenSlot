import { fireEvent, render, screen } from "@testing-library/react"
import { axe, toHaveNoViolations } from "jest-axe"
import { describe, expect, it, vi } from "vitest"
import RootError from "../error"
import RootLoading from "../loading"
import DashboardError from "../(dashboard)/error"
import DashboardLoading from "../(dashboard)/loading"
import DashboardNotFound from "../(dashboard)/not-found"

expect.extend(toHaveNoViolations)

describe("route feedback states", () => {
  it("renders accessible global and dashboard loading feedback", () => {
    const { unmount } = render(<RootLoading />)
    expect(screen.getByRole("status").textContent).toContain("Loading OpenSlot")
    unmount()

    render(<DashboardLoading />)
    expect(screen.getByRole("status").textContent).toContain(
      "Loading your dashboard"
    )
  })

  it.each([
    ["global", RootError],
    ["dashboard", DashboardError],
  ] as const)("uses unstable_retry for the %s error boundary", (_label, ErrorState) => {
    const unstableRetry = vi.fn()
    const rawMessage = "database password and internal table details"

    render(
      <ErrorState
        error={new Error(rawMessage)}
        unstable_retry={unstableRetry}
      />
    )

    expect(screen.getByRole("alert").textContent).not.toContain(rawMessage)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(unstableRetry).toHaveBeenCalledTimes(1)
  })

  it("renders a branded dashboard not-found recovery link", () => {
    render(<DashboardNotFound />)

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Page not found"
    )
    expect(
      screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")
    ).toBe("/dashboard")
  })

  it("has no detectable accessibility violations", async () => {
    const retry = vi.fn()
    const states = [
      <RootLoading key="root-loading" />,
      <DashboardLoading key="dashboard-loading" />,
      <RootError
        key="root-error"
        error={new Error("hidden")}
        unstable_retry={retry}
      />,
      <DashboardError
        key="dashboard-error"
        error={new Error("hidden")}
        unstable_retry={retry}
      />,
      <DashboardNotFound key="dashboard-not-found" />,
    ]

    for (const state of states) {
      const { container, unmount } = render(state)
      expect(await axe(container)).toHaveNoViolations()
      unmount()
    }
  })
})
