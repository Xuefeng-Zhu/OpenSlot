import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupPage from "../page";

const mocks = vi.hoisted(() => {
  const signUp = vi.fn();

  return {
    push: vi.fn(),
    refresh: vi.fn(),
    signUp,
    createBrowserBackendClient: vi.fn(() => ({
      auth: {
        signUp,
      },
    })),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/backend/compat/browser-client", () => ({
  createBrowserBackendClient: mocks.createBrowserBackendClient,
}));

describe("SignupPage", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.signUp.mockReset();
    mocks.createBrowserBackendClient.mockClear();
  });

  it("routes to the dashboard when signup creates a session", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "sarah@example.com" } },
      error: null,
    });

    render(<SignupPage />);
    submitValidSignupForm();

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith({
        email: "sarah@example.com",
        password: "Passw0rd!",
        options: { data: { full_name: "Sarah Chen" } },
      });
      expect(mocks.push).toHaveBeenCalledWith("/dashboard");
      expect(mocks.refresh).toHaveBeenCalled();
    });
  });

  it("routes to login when signup succeeds but Butterbase requires a separate login", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: "auth-user-1", email: "sarah@example.com" },
        requiresLogin: true,
      },
      error: null,
    });

    render(<SignupPage />);
    submitValidSignupForm();

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        "/login?returnUrl=%2Fdashboard"
      );
      expect(mocks.refresh).toHaveBeenCalled();
    });
  });

  it("accepts pasted emails with leading or trailing whitespace", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "sarah@example.com" } },
      error: null,
    });

    render(<SignupPage />);
    submitValidSignupForm({ email: "  sarah@example.com  " });

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith({
        email: "sarah@example.com",
        password: "Passw0rd!",
        options: { data: { full_name: "Sarah Chen" } },
      });
    });
    expect(
      screen.queryByText("Please enter a valid email address.")
    ).toBeNull();
  });

  it("communicates password requirement status without relying on color", () => {
    render(<SignupPage />);

    expect(
      screen.getByRole("list", { name: "Password requirements" })
    ).toBeDefined();
    expectPasswordRequirementState("At least 8 characters", "unmet", "Not met:");

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Passw0rd!" },
    });

    for (const label of [
      "At least 8 characters",
      "Includes a number",
      "Includes a lowercase letter",
      "Includes an uppercase letter",
      "Includes a special character",
    ]) {
      expectPasswordRequirementState(label, "met", "Met:");
    }
  });

  it("announces validation errors and focuses the first invalid field", () => {
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Sarah Chen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(document.activeElement).toBe(screen.getByLabelText("Email address"));
    expect(screen.getByRole("alert").textContent).toContain(
      "Please correct the highlighted fields"
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("provides a full-size keyboard-visible password visibility control", () => {
    render(<SignupPage />);

    const passwordInput = screen.getByLabelText("Password");
    const visibilityButton = screen.getByRole("button", {
      name: "Show password",
    });

    expect(visibilityButton.className).toContain("h-11");
    expect(visibilityButton.className).toContain("w-11");
    expect(visibilityButton.className).toContain("focus-visible:ring-2");
    expect(passwordInput.getAttribute("type")).toBe("password");

    fireEvent.click(visibilityButton);

    expect(passwordInput.getAttribute("type")).toBe("text");
    expect(
      screen.getByRole("button", { name: "Hide password" })
    ).toBeDefined();
  });
});

function submitValidSignupForm({ email = "sarah@example.com" } = {}) {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Sarah Chen" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Passw0rd!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

function expectPasswordRequirementState(
  label: string,
  state: "met" | "unmet",
  statusText: string
) {
  const requirement = screen.getByText(label).closest("[data-state]");

  expect(requirement?.getAttribute("data-state")).toBe(state);
  expect(requirement?.textContent).toContain(statusText);
}
