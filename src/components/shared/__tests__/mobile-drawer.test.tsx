import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import type { AnchorHTMLAttributes } from "react";
import { MobileDrawer } from "../mobile-drawer";
import {
  DashboardNavigationGuardProvider,
  useDashboardUnsavedChanges,
} from "@/components/dashboard/navigation-guard-provider";

expect.extend(toHaveNoViolations);

const signOutMock = vi.hoisted(() => vi.fn());
const copyTextMock = vi.hoisted(() => vi.fn());

const routerMock = {
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
};

vi.mock("@/components/dashboard/dashboard-sign-out-provider", () => ({
  useDashboardSignOut: () => ({
    isSigningOut: false,
    signOut: signOutMock,
  }),
}));

vi.mock("@/lib/utils/clipboard", () => ({
  copyTextToClipboard: copyTextMock,
}));

interface MockLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  onNavigate?: (event: { preventDefault: () => void }) => void;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | "auto" | null;
}

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: React.forwardRef<HTMLAnchorElement, MockLinkProps>(
      function MockNextLink(
        { href, onNavigate, onClick, replace, scroll, prefetch, ...props },
        ref
      ) {
        void replace;
        void scroll;
        void prefetch;

        return (
          <a
            {...props}
            ref={ref}
            href={href}
            onClick={(event) => {
              onClick?.(event);
              if (event.defaultPrevented) return;
              onNavigate?.({ preventDefault: () => event.preventDefault() });
            }}
          />
        );
      }
    ),
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => routerMock,
}));

function DirtyDrawerState({ children }: { children: React.ReactNode }) {
  useDashboardUnsavedChanges("mobile-drawer-test", true, () => undefined);
  return children;
}

describe("MobileDrawer", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    user: {
      name: "Jane Doe",
      email: "jane@example.com",
      username: "jane",
      avatarUrl: null,
    },
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <MobileDrawer open={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders navigation items when open", () => {
    render(<MobileDrawer {...defaultProps} />);

    expect(screen.getByText("Overview")).toBeDefined();
    expect(screen.getByText("Event Types")).toBeDefined();
    expect(screen.getByText("Availability")).toBeDefined();
    expect(screen.getByText("Bookings")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders the OpenSlot logo", () => {
    render(<MobileDrawer {...defaultProps} />);
    expect(screen.getByText("OpenSlot")).toBeDefined();
  });

  it("renders user profile section", () => {
    render(<MobileDrawer {...defaultProps} />);

    expect(screen.getByText("Jane Doe")).toBeDefined();
    expect(screen.getByText("jane@example.com")).toBeDefined();
  });

  it("marks the active navigation item", () => {
    render(<MobileDrawer {...defaultProps} />);

    const dashboardLink = screen.getByText("Overview").closest("a");
    expect(dashboardLink?.getAttribute("aria-current")).toBe("page");

    const bookingsLink = screen.getByText("Bookings").closest("a");
    expect(bookingsLink?.getAttribute("aria-current")).toBeNull();
  });

  it("closes only after dirty navigation is confirmed", () => {
    const onClose = vi.fn();
    render(
      <DashboardNavigationGuardProvider>
        <DirtyDrawerState>
          <MobileDrawer
            open={true}
            onClose={onClose}
            user={defaultProps.user}
          />
        </DirtyDrawerState>
      </DashboardNavigationGuardProvider>
    );

    fireEvent.click(screen.getByText("Bookings"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<MobileDrawer open={true} onClose={onClose} user={defaultProps.user} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MobileDrawer open={true} onClose={onClose} user={defaultProps.user} />
    );

    // The overlay is the first div with aria-hidden="true" inside the fixed container
    const overlay = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("has accessible navigation landmark", () => {
    render(<MobileDrawer {...defaultProps} />);

    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(nav).toBeDefined();
  });

  it("keeps navigation and mobile actions reachable on short screens", () => {
    render(<MobileDrawer {...defaultProps} />);

    const navigation = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    const scrollRegion = navigation.parentElement;

    expect(scrollRegion?.classList.contains("min-h-0")).toBe(true);
    expect(scrollRegion?.classList.contains("flex-1")).toBe(true);
    expect(scrollRegion?.classList.contains("overflow-y-auto")).toBe(true);
    expect(
      screen.getByRole("link", { name: "New event type" }).getAttribute("href")
    ).toBe("/event-types/new");
    expect(
      screen.getByRole("button", { name: "Copy booking link" })
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
  });

  it("copies the host booking link from the mobile action", async () => {
    copyTextMock.mockResolvedValue(undefined);
    render(<MobileDrawer {...defaultProps} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Copy booking link" })
    );

    await waitFor(() => {
      expect(copyTextMock).toHaveBeenCalledOnce();
      expect(copyTextMock.mock.calls[0][0]).toMatch(/\/jane$/);
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();
  });

  it("uses the shared mobile sign-out action", () => {
    render(<MobileDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOutMock).toHaveBeenCalledOnce();
  });

  it("renders without user prop", () => {
    render(<MobileDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByText("User")).toBeDefined();
    expect(screen.getByText("Overview")).toBeDefined();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<MobileDrawer {...defaultProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
