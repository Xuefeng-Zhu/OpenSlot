import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "../page";

const mocks = vi.hoisted(() => {
  const signInWithPassword = vi.fn();

  return {
    push: vi.fn(),
    refresh: vi.fn(),
    signInWithPassword,
    createClient: vi.fn(() => ({
      auth: {
        signInWithPassword,
      },
    })),
    setBrowserAuthSessionPersistence: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/auth-cookie-persistence", () => ({
  setBrowserAuthSessionPersistence: mocks.setBrowserAuthSessionPersistence,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.createClient.mockClear();
    mocks.setBrowserAuthSessionPersistence.mockReset();
    window.history.pushState({}, "", "/login");
  });

  it("shows a keep-signed-in option enabled by default", () => {
    render(<LoginPage />);

    const keepSignedIn = screen.getByRole("checkbox", {
      name: "Keep me signed in",
    }) as HTMLInputElement;

    expect(keepSignedIn.checked).toBe(true);
  });

  it("signs in with a persistent session when keep signed in remains enabled", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(mocks.setBrowserAuthSessionPersistence).toHaveBeenCalledWith(true);
      expect(mocks.createClient).toHaveBeenCalledWith({ keepSignedIn: true });
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "sarah@example.com",
        password: "correct-horse",
      });
      expect(mocks.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("signs in with a browser-session login when keep signed in is disabled", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sarah@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep me signed in" }));
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(mocks.setBrowserAuthSessionPersistence).toHaveBeenCalledWith(false);
      expect(mocks.createClient).toHaveBeenCalledWith({ keepSignedIn: false });
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "sarah@example.com",
        password: "correct-horse",
      });
      expect(mocks.push).toHaveBeenCalledWith("/dashboard");
    });
  });
});
