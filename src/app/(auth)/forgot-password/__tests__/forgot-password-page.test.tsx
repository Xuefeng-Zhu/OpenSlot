import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "../page";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail,
    },
  }),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    window.history.pushState({}, "", "/forgot-password");
  });

  it("requires an email before requesting a reset link", () => {
    render(<ForgotPasswordPage />);

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByText("Email is required.")).toBeDefined();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("requests a password reset email with the reset route as redirect", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " sarah@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith("sarah@example.com", {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    });

    expect(
      screen.getByText(
        "If an account exists for that email, a reset link is on its way."
      )
    ).toBeDefined();
  });

  it("shows a safe generic error when Supabase rejects the reset request", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: new Error("rate limited"),
    });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText("Unable to send reset email. Please try again.")
    ).toBeDefined();
  });
});
