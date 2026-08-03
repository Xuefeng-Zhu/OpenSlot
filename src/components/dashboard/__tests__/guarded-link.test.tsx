import {
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GuardedLink } from "../guarded-link"
import {
  DashboardNavigationGuardProvider,
  useDashboardUnsavedChanges,
} from "../navigation-guard-provider"

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}))

interface MockLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string
  onNavigate?: (event: { preventDefault: () => void }) => void
  replace?: boolean
  scroll?: boolean
  prefetch?: boolean | "auto" | null
}

vi.mock("next/link", async () => {
  const React = await import("react")

  return {
    default: React.forwardRef<HTMLAnchorElement, MockLinkProps>(
      function MockNextLink(
        { href, onNavigate, onClick, replace, scroll, prefetch, ...props },
        ref
      ) {
        void replace
        void scroll
        void prefetch

        return (
          <a
            {...props}
            ref={ref}
            href={href}
            onClick={(event) => {
              onClick?.(event)
              if (event.defaultPrevented) return
              onNavigate?.({ preventDefault: () => event.preventDefault() })
            }}
          />
        )
      }
    ),
  }
})

function DirtySource({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(true)
  useDashboardUnsavedChanges("guarded-link-test", dirty, () => setDirty(false))
  return children
}

function renderDirtyLink(link: ReactNode) {
  return render(
    <DashboardNavigationGuardProvider>
      <DirtySource>{link}</DirtySource>
    </DashboardNavigationGuardProvider>
  )
}

describe("GuardedLink", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("waits for confirmation before pushing a dirty navigation", () => {
    renderDirtyLink(<GuardedLink href="/bookings">Bookings</GuardedLink>)

    fireEvent.click(screen.getByRole("link", { name: "Bookings" }))

    expect(routerMocks.push).not.toHaveBeenCalled()
    expect(
      screen.getByRole("dialog", { name: "Discard unsaved changes?" })
    ).toBeDefined()

    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" })
    )

    expect(routerMocks.push).toHaveBeenCalledWith("/bookings", {
      scroll: undefined,
    })
  })

  it("keeps a dirty navigation on the current page", () => {
    renderDirtyLink(<GuardedLink href="/contacts">Contacts</GuardedLink>)

    fireEvent.click(screen.getByRole("link", { name: "Contacts" }))
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))

    expect(routerMocks.push).not.toHaveBeenCalled()
  })

  it("preserves replace and scroll options after confirmation", () => {
    renderDirtyLink(
      <GuardedLink href="/settings" replace scroll={false}>
        Settings
      </GuardedLink>
    )

    fireEvent.click(screen.getByRole("link", { name: "Settings" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" })
    )

    expect(routerMocks.replace).toHaveBeenCalledWith("/settings", {
      scroll: false,
    })
  })
})
