import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { MobileDrawer } from "../mobile-drawer";
import {
  DashboardNavigationGuardProvider,
  useDashboardUnsavedChanges,
} from "@/components/dashboard/navigation-guard-provider";

const routerMock = {
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
};

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
      avatarUrl: null,
    },
  };

  it("renders nothing when closed", () => {
    const { container } = render(
      <MobileDrawer open={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders navigation items when open", () => {
    render(<MobileDrawer {...defaultProps} />);

    expect(screen.getByText("Dashboard")).toBeDefined();
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

    const dashboardLink = screen.getByText("Dashboard").closest("a");
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

  it("renders without user prop", () => {
    render(<MobileDrawer open={true} onClose={vi.fn()} />);

    expect(screen.getByText("User")).toBeDefined();
    expect(screen.getByText("Dashboard")).toBeDefined();
  });
});
