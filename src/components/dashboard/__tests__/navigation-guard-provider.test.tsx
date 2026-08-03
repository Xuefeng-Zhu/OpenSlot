import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { axe, toHaveNoViolations } from "jest-axe"
import { describe, expect, it, vi } from "vitest"
import {
  DashboardNavigationGuardProvider,
  useDashboardNavigationGuard,
  useDashboardUnsavedChanges,
} from "../navigation-guard-provider"

expect.extend(toHaveNoViolations)

function NavigationHarness({
  initiallyDirty = false,
  onDiscard = () => undefined,
  onNavigate = () => undefined,
}: {
  initiallyDirty?: boolean
  onDiscard?: () => void
  onNavigate?: () => void
}) {
  const [dirty, setDirty] = useState(initiallyDirty)
  const { requestNavigation } = useDashboardNavigationGuard()

  useDashboardUnsavedChanges("test-editor", dirty, () => {
    onDiscard()
    setDirty(false)
  })

  return (
    <>
      <span>{dirty ? "Dirty" : "Clean"}</span>
      <button type="button" onClick={() => setDirty((current) => !current)}>
        Toggle dirty
      </button>
      <button type="button" onClick={() => requestNavigation(onNavigate)}>
        Leave editor
      </button>
    </>
  )
}

describe("DashboardNavigationGuardProvider", () => {
  it("runs navigation immediately when no source is dirty", () => {
    const onNavigate = vi.fn()

    render(
      <DashboardNavigationGuardProvider>
        <NavigationHarness onNavigate={onNavigate} />
      </DashboardNavigationGuardProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Leave editor" }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" })
    ).toBeNull()
  })

  it("keeps editing without navigating and discards before continuing", async () => {
    const order: string[] = []

    render(
      <DashboardNavigationGuardProvider>
        <NavigationHarness
          initiallyDirty
          onDiscard={() => order.push("discard")}
          onNavigate={() => order.push("navigate")}
        />
      </DashboardNavigationGuardProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Leave editor" }))

    expect(
      screen.getByRole("dialog", { name: "Discard unsaved changes?" })
    ).toBeDefined()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Keep editing" })
      )
    )

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(order).toEqual([])
    expect(screen.getByText("Dirty")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Leave editor" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" })
    )

    expect(order).toEqual(["discard", "navigate"])
    expect(await screen.findByText("Clean")).toBeDefined()
  })

  it("protects browser unload only while a source remains dirty", async () => {
    render(
      <DashboardNavigationGuardProvider>
        <NavigationHarness initiallyDirty />
      </DashboardNavigationGuardProvider>
    )

    const dirtyUnload = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(dirtyUnload)
    expect(dirtyUnload.defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Toggle dirty" }))
    await waitFor(() => expect(screen.getByText("Clean")).toBeDefined())

    const cleanUnload = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(cleanUnload)
    expect(cleanUnload.defaultPrevented).toBe(false)
  })

  it("renders an accessible confirmation dialog", async () => {
    const { container } = render(
      <DashboardNavigationGuardProvider>
        <NavigationHarness initiallyDirty />
      </DashboardNavigationGuardProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Leave editor" }))

    expect(await axe(container)).toHaveNoViolations()
  })
})
