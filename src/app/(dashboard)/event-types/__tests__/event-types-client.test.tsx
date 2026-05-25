import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypesClient } from "../event-types-client";

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const eventTypes = [
  {
    id: "event-type-1",
    title: "Intro call",
    description: "A short planning call.",
    durationMinutes: 30,
    locationType: "Online",
    slug: "intro-call",
    isActive: true,
    bookingUrl: "https://openslot.test/sarah/intro-call",
  },
];

describe("EventTypesClient", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    toastMock.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: originalExecCommand,
    });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the clipboard fallback when async clipboard writes are unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => true),
    });

    render(<EventTypesClient initialEventTypes={eventTypes} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy booking link for Intro call",
      })
    );

    await waitFor(() => {
      expect(document.execCommand).toHaveBeenCalledWith("copy");
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Link copied!",
      description: "Booking URL has been copied to your clipboard.",
    });
  });

  it("shows the delete fallback when the API returns a non-JSON error", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response("server unavailable", { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EventTypesClient initialEventTypes={eventTypes} />);

    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "More options for Intro call",
      }),
      { button: 0, ctrlKey: false }
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Delete",
      })
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/event-types/event-type-1", {
        method: "DELETE",
      })
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "Could not delete event type",
      description: "Please try again.",
      variant: "destructive",
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText("Intro call")).toBeDefined();
  });
});
