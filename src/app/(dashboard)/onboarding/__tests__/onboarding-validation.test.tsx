import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import OnboardingPage from "../page";

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

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.getByText("Create your first event type")).toBeDefined();
    expect(screen.getByText("Enter a title for this event type.")).toBeDefined();
    expect(
      screen.getByText("Enter where this meeting will happen.")
    ).toBeDefined();
    expect(screen.queryByText("Share your booking link")).toBeNull();
  });
});
