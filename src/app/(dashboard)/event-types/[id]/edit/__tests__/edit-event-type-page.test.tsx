import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventTypeEditor,
  type EditableEventType,
} from "../../../event-type-editor";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const strategySession: EditableEventType = {
  id: "event-type-2",
  title: "Strategy session",
  slug: "strategy-session",
  description: "A deeper session to discuss goals and next steps.",
  duration_minutes: 60,
  buffer_before_minutes: 5,
  buffer_after_minutes: 5,
  min_notice_minutes: 60,
  max_booking_days_ahead: 60,
  location_type: "online",
  location_value: "https://zoom.us/j/987654",
  is_active: true,
};

describe("EditEventTypePage editor", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("loads the event type selected from the event types list", () => {
    render(
      <EventTypeEditor
        mode="edit"
        hostName="Sarah Chen"
        initialEventType={strategySession}
      />
    );

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

  it("clears field-level validation errors when corrected", () => {
    render(
      <EventTypeEditor
        mode="edit"
        hostName="Sarah Chen"
        initialEventType={strategySession}
      />
    );

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
