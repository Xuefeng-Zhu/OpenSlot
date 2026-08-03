import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypeEditor } from "../../event-type-editor";

expect.extend(toHaveNoViolations);

const push = vi.fn();
const refresh = vi.fn();
const schedules = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Default schedule",
    is_default: true,
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const hostProfile = {
  id: "host-1",
  name: "Sarah Chen",
  username: "sarah",
  avatar_url: null,
};

async function fillMinimalValidEventType() {
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "QA Coffee Chat" },
  });
  fireEvent.change(screen.getByLabelText("URL Slug"), {
    target: { value: "qa-coffee-chat" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Location/ }));
  fireEvent.change(screen.getByLabelText("Location type"), {
    target: { value: "custom" },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Location type")).toHaveProperty(
      "value",
      "custom"
    )
  );
  fireEvent.change(screen.getByLabelText("Location details"), {
    target: { value: "https://meet.example/qa-coffee-chat" },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Location details")).toHaveProperty(
      "value",
      "https://meet.example/qa-coffee-chat"
    )
  );
}

describe("NewEventTypePage editor", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses one page h1 and a subordinate preview hierarchy", async () => {
    const { container } = render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Create event type" })
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 2, name: "Live preview" })
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 3, name: "Event Title" })
    ).toBeDefined();
    expect(await axe(container)).toHaveNoViolations();
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

  it("keeps create-mode Save enabled for validation discovery", () => {
    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      false
    );
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

  it("validates reminder recipient controls", async () => {
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

    await fillMinimalValidEventType();
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

  it("reopens collapsed sections that contain validation errors", async () => {
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

    await fillMinimalValidEventType();
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

  it("submits a valid event type and refreshes the event type list", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    await fillMinimalValidEventType();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/event-types",
        expect.objectContaining({
          credentials: "same-origin",
          method: "POST",
        })
      )
    );

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      title: "QA Coffee Chat",
      slug: "qa-coffee-chat",
      schedule_id: schedules[0].id,
      location_value: "https://meet.example/qa-coffee-chat",
    });
    expect(push).toHaveBeenCalledWith("/event-types");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the save fallback when the API returns a non-JSON error", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response("server unavailable", { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    await fillMinimalValidEventType();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Failed to save event type.")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("recovers when the save request times out", async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          if (signal instanceof AbortSignal) {
            signal.addEventListener("abort", () => {
              const error = new Error("Request aborted");
              error.name = "AbortError";
              reject(error);
            });
          }
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventTypeEditor
        mode="create"
        hostProfile={hostProfile}
        schedules={schedules}
      />
    );

    await fillMinimalValidEventType();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toHaveProperty(
      "disabled",
      true
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/event-types",
      expect.objectContaining({
        credentials: "same-origin",
        method: "POST",
        signal: expect.any(AbortSignal),
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    vi.useRealTimers();

    expect(
      await screen.findByText("Saving event type timed out. Please try again.")
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      false
    );
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
