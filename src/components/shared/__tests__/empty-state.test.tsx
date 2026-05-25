import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders icon, heading, and description", () => {
    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No items yet"
        description="Create your first item to get started."
      />
    );

    expect(screen.getByTestId("test-icon")).toBeDefined();
    expect(screen.getByText("No items yet")).toBeDefined();
    expect(screen.getByText("Create your first item to get started.")).toBeDefined();
  });

  it("hides decorative icons from assistive technology", () => {
    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No items yet"
        description="Create your first item to get started."
      />
    );

    expect(screen.getByTestId("test-icon").parentElement?.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  it("renders action button when action prop is provided", () => {
    const onClick = vi.fn();

    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No items yet"
        description="Create your first item to get started."
        action={{ label: "Create item", onClick }}
      />
    );

    const button = screen.getByRole("button", { name: "Create item" });
    expect(button).toBeDefined();
  });

  it("calls action onClick when button is clicked", () => {
    const onClick = vi.fn();

    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No items yet"
        description="Create your first item to get started."
        action={{ label: "Create item", onClick }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create item" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render a button when action prop is omitted", () => {
    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No items yet"
        description="Create your first item to get started."
      />
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders action button with outline variant when specified", () => {
    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No items"
        description="Nothing here."
        action={{ label: "Add", onClick: vi.fn(), variant: "outline" }}
      />
    );

    const button = screen.getByRole("button", { name: "Add" });
    expect(button.className).toContain("border");
  });

  it("centers content with flex layout", () => {
    const { container } = render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="Empty"
        description="Nothing to show."
      />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("justify-center");
  });

  it("displays heading as semibold text", () => {
    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No data"
        description="Check back later."
      />
    );

    const heading = screen.getByText("No data");
    expect(heading.className).toContain("font-semibold");
  });

  it("displays description as muted text", () => {
    render(
      <EmptyState
        icon={<svg data-testid="test-icon" />}
        heading="No data"
        description="Check back later."
      />
    );

    const description = screen.getByText("Check back later.");
    expect(description.className).toContain("text-muted-foreground");
  });
});
