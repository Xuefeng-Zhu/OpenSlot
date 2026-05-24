import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypeEditor } from "../../event-type-editor";

const push = vi.fn();
const schedules = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Default schedule",
    is_default: true,
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const hostProfile = {
  id: "host-1",
  name: "Sarah Chen",
  username: "sarah",
  avatar_url: null,
};

describe("NewEventTypePage editor", () => {
  beforeEach(() => {
    push.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears field-level validation errors when corrected", () => {
    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Title is required")).toBeDefined();
    expect(screen.getByText("URL slug is required")).toBeDefined();
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe(
      "true"
    );
    expect(
      screen.getByLabelText("Title").getAttribute("aria-describedby")
    ).toBe("title-error");
    expect(
      screen.getByLabelText("URL Slug").getAttribute("aria-describedby")
    ).toBe("slug-error");

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

  it("lets hosts add a structured invitee question", () => {
    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Invitee Questions/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    fireEvent.change(screen.getByLabelText("Question label"), {
      target: { value: "What should we discuss?" },
    });

    expect(screen.getByDisplayValue("What should we discuss?")).toBeDefined();
    expect(screen.getByText("Required")).toBeDefined();
  });

  it("validates reminder recipient controls", () => {
    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "Enable pre-meeting reminders" })
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Email guest reminders" })
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Email host reminders" })
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "QA Coffee Chat" },
    });
    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "qa-coffee-chat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Select at least one reminder recipient")
    ).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain(
      "Select at least one reminder recipient"
    );
    expect(
      screen
        .getByRole("switch", { name: "Email guest reminders" })
        .getAttribute("aria-describedby")
    ).toBe("reminder-recipient-error");
    expect(
      screen
        .getByRole("switch", { name: "Email host reminders" })
        .getAttribute("aria-describedby")
    ).toBe("reminder-recipient-error");
  });

  it("reopens collapsed sections that contain validation errors", () => {
    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    const remindersSection = screen.getByRole("button", {
      name: "Reminders",
    });

    fireEvent.click(remindersSection);
    fireEvent.click(
      screen.getByRole("switch", { name: "Enable pre-meeting reminders" })
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Email guest reminders" })
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Email host reminders" })
    );
    fireEvent.click(remindersSection);

    expect(remindersSection.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByText("Select at least one reminder recipient")
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "QA Coffee Chat" },
    });
    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "qa-coffee-chat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(remindersSection.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText("Select at least one reminder recipient")
    ).toBeDefined();
  });

  it("surfaces calendar connection load failures", () => {
    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
        calendarConnectionsLoadFailed
      />
    );

    expect(
      screen.getByText(
        /Calendar connection status could not be loaded/
      )
    ).toBeDefined();
  });

  it("renders an unsaved public schedule shell without requesting availability", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    expect(screen.getByText("Event Title")).toBeDefined();
    expect(screen.getByText("Sarah Chen")).toBeDefined();
    expect(screen.getAllByText("30 min").length).toBeGreaterThan(0);
    expect(screen.getByText("Select a date")).toBeDefined();
    expect(screen.getByText("Available times")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "QA Coffee Chat" },
    });

    expect(screen.getByText("QA Coffee Chat")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
