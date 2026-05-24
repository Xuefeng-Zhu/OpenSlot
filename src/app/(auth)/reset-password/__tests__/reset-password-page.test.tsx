import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "../page";

const fetchMock = vi.fn();

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires an email and reset code before submitting", () => {
    render(<ResetPasswordPage />);

    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("Email is required.")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("Reset code is required.")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the reset code and new password for matching inputs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " sarah@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Reset code"), {
      target: { value: " 123456 " },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "sarah@example.com",
          code: "123456",
          password: "correct-horse",
        }),
      });
    });

    expect(screen.getByText("Your password has been updated.")).toBeDefined();
  });

  it("shows the backend reset error when the code is rejected", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unable to update password." }),
    });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Reset code"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Unable to update password.")
    ).toBeDefined();
  });

  it("shows a safe generic error when the reset request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network unavailable"));

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Reset code"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText(
        "Unable to update password. Please request a new code."
      )
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Update password" }).getAttribute(
        "disabled"
      )
    ).toBeNull();
  });

  it("validates password length and confirmation before updating", () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Reset code"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("Password must be at least 8 characters.")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText("Passwords do not match.")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
