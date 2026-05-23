import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupPage from "../page";

const mocks = vi.hoisted(() => {
  const signUp = vi.fn();

  return {
    push: vi.fn(),
    refresh: vi.fn(),
    signUp,
    createClient: vi.fn(() => ({
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

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

describe("SignupPage", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.signUp.mockReset();
    mocks.createClient.mockClear();
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
});

function submitValidSignupForm() {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Sarah Chen" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "sarah@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Passw0rd!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}
