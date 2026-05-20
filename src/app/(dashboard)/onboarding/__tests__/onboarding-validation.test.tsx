import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OnboardingPage from "../page";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function advanceFromProfile() {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Sarah Chen" },
  });
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "sarah-chen" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("Onboarding validation", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps users on profile setup until required profile fields are filled", () => {
    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Create your public profile")).toBeDefined();
    expect(
      screen.getByText("Enter the display name people will see.")
    ).toBeDefined();
    expect(
      screen.getByText("Choose a username for your booking link.")
    ).toBeDefined();
    expect(screen.queryByText("Set your availability")).toBeNull();
  });

  it("keeps users on availability setup when an added interval is incomplete", () => {
    render(<OnboardingPage />);
    advanceFromProfile();

    fireEvent.click(
      screen.getByRole("button", { name: "Add interval for Monday" })
    );
    expect(screen.getByLabelText("Start time for Monday interval 2")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Set your availability")).toBeDefined();
    expect(
      screen.getByText(
        "Complete each interval with an end time after the start time."
      )
    ).toBeDefined();
    expect(screen.queryByText("Create your first event type")).toBeNull();
  });

  it("keeps users on event type setup until required event fields are filled", () => {
    render(<OnboardingPage />);
    advanceFromProfile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Location type"), {
      target: { value: "custom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.getByText("Create your first event type")).toBeDefined();
    expect(screen.getByText("Enter a title for this event type.")).toBeDefined();
    expect(screen.getByText("Enter location details.")).toBeDefined();
    expect(screen.queryByText("Share your booking link")).toBeNull();
  });

  it("saves onboarding data before showing the booking link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        bookingLink: "/sarah-chen/intro-call",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<OnboardingPage />);
    advanceFromProfile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Intro Call" },
    });
    fireEvent.change(screen.getByLabelText("Location type"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByLabelText("Location details"), {
      target: { value: "Zoom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => {
      expect(screen.getByText("Share your booking link")).toBeDefined();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onboarding",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.profile).toEqual({
      displayName: "Sarah Chen",
      username: "sarah-chen",
    });
    expect(requestBody.eventType).toEqual({
      title: "Intro Call",
      duration: "30",
      locationType: "custom",
      locationValue: "Zoom",
      videoProvider: null,
    });
    expect(requestBody.availability.monday.intervals).toEqual([
      { start: "09:00", end: "17:00" },
    ]);
    expect(screen.getByText("openslot.com/sarah-chen/intro-call")).toBeDefined();
    expect(refresh).toHaveBeenCalled();
  });

  it("uses the event type location selector for generated video locations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        bookingLink: "/sarah-chen/intro-call",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<OnboardingPage />);
    advanceFromProfile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Intro Call" },
    });
    fireEvent.change(screen.getByLabelText("Location type"), {
      target: { value: "google_meet" },
    });

    expect(screen.queryByLabelText("Location details")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => {
      expect(screen.getByText("Share your booking link")).toBeDefined();
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.eventType).toEqual({
      title: "Intro Call",
      duration: "30",
      locationType: "video_provider",
      locationValue: "",
      videoProvider: "google_meet",
    });
  });
});
