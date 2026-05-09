import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "../page";

const exchangeCodeForSession = vi.fn();
const getSession = vi.fn();
const updateUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession,
      getSession,
      updateUser,
    },
  }),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    getSession.mockReset();
    updateUser.mockReset();
  });

  it("blocks password updates when opened without a recovery link", async () => {
    window.history.pushState({}, "", "/reset-password");
    getSession.mockResolvedValue({
      data: {
        session: { user: { id: "user-1" } },
      },
    });

    render(<ResetPasswordPage />);

    expect(
      await screen.findByText(
        "Open the password reset link from your email to continue."
      )
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Update password" }).hasAttribute("disabled")
    ).toBe(true);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE code and updates the password for matching inputs", async () => {
    window.history.pushState({}, "", "/reset-password?code=recovery-code");
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({
      data: {
        session: { user: { id: "user-1" } },
      },
    });
    updateUser.mockResolvedValue({ error: null });

    render(<ResetPasswordPage />);

    await screen.findByLabelText("New password");

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
      expect(updateUser).toHaveBeenCalledWith({ password: "correct-horse" });
    });

    expect(screen.getByText("Your password has been updated.")).toBeDefined();
  });

  it("uses an existing recovery session when code exchange already failed", async () => {
    window.history.pushState({}, "", "/reset-password?code=recovery-code");
    exchangeCodeForSession.mockResolvedValue({
      error: new Error("auth code already used"),
    });
    getSession.mockResolvedValue({
      data: {
        session: { user: { id: "user-1" } },
      },
    });
    updateUser.mockResolvedValue({ error: null });

    render(<ResetPasswordPage />);

    await screen.findByLabelText("New password");

    expect(exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    expect(getSession).toHaveBeenCalled();
    expect(
      screen.queryByText("This password reset link is invalid or has expired.")
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: "correct-horse" });
    });
  });

  it("validates password length and confirmation before updating", async () => {
    window.history.pushState({}, "", "/reset-password?code=recovery-code");
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({
      data: {
        session: { user: { id: "user-1" } },
      },
    });

    render(<ResetPasswordPage />);

    await screen.findByLabelText("New password");

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("Password must be at least 8 characters.")).toBeDefined();
    expect(updateUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("Passwords do not match.")).toBeDefined();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
