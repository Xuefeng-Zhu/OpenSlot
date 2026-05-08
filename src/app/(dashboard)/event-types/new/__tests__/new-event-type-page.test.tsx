import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypeEditor } from "../../event-type-editor";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("NewEventTypePage editor", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("clears field-level validation errors when corrected", () => {
    render(<EventTypeEditor mode="create" hostName="Sarah Chen" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Title is required")).toBeDefined();
    expect(screen.getByText("URL slug is required")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "QA Coffee Chat" },
    });

    expect(screen.queryByText("Title is required")).toBeNull();
    expect(screen.getByText("URL slug is required")).toBeDefined();

    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "qa-coffee-chat" },
    });

    expect(screen.queryByText("URL slug is required")).toBeNull();
  });
});
