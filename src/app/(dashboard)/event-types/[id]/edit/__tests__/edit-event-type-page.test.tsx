import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditEventTypePage from "../page";

const push = vi.fn();
let routeParams: { id?: string | string[] } = { id: "2" };

vi.mock("next/navigation", () => ({
  useParams: () => routeParams,
  useRouter: () => ({ push }),
}));

describe("EditEventTypePage", () => {
  beforeEach(() => {
    push.mockClear();
    routeParams = { id: "2" };
  });

  it("loads the event type selected from the event types list", () => {
    render(<EditEventTypePage />);

    expect(
      screen.getByText('Update the settings for "Strategy session".')
    ).toBeDefined();
    expect(screen.getByText("Sarah Chen")).toBeDefined();
    expect(screen.getByText("60 min")).toBeDefined();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Strategy session"
    );
    expect((screen.getByLabelText("URL Slug") as HTMLInputElement).value).toBe(
      "strategy-session"
    );
    expect(
      (screen.getByLabelText("Description") as HTMLTextAreaElement).value
    ).toBe("A deeper session to discuss goals and next steps.");
  });

  it("shows a recoverable empty state for an unknown event type id", () => {
    routeParams = { id: "missing" };

    render(<EditEventTypePage />);

    expect(screen.getByText("Event type not found")).toBeDefined();
    expect(
      screen.getByText(
        "We couldn't find that event type. It may have been deleted."
      )
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Back to event types" }));
    expect(push).toHaveBeenCalledWith("/event-types");
  });

  it("clears field-level validation errors when corrected", () => {
    render(<EditEventTypePage />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Title is required")).toBeDefined();
    expect(screen.getByText("URL slug is required")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Strategy workshop" },
    });

    expect(screen.queryByText("Title is required")).toBeNull();
    expect(screen.getByText("URL slug is required")).toBeDefined();

    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "strategy-workshop" },
    });

    expect(screen.queryByText("URL slug is required")).toBeNull();
  });
});
