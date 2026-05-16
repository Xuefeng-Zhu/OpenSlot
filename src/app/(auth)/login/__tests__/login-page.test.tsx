import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "../login-form";
import LoginPage from "../page";
import { loginReturnUrl } from "../return-url";

const mocks = vi.hoisted(() => {
  const signInWithPassword = vi.fn();
  const getUser = vi.fn();

  return {
    push: vi.fn(),
    refresh: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    getUser,
    createServerSupabaseClient: vi.fn(() => ({
      auth: {
        getUser,
      },
    })),
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
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("@/lib/supabase/auth-cookie-persistence", () => ({
  setBrowserAuthSessionPersistence: mocks.setBrowserAuthSessionPersistence,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.redirect.mockClear();
    mocks.getUser.mockReset();
    mocks.createServerSupabaseClient.mockClear();
    mocks.signInWithPassword.mockReset();
    mocks.createClient.mockClear();
    mocks.setBrowserAuthSessionPersistence.mockReset();
    window.history.pushState({}, "", "/login");
  });

  it("redirects authenticated users away from login", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
    });

    await expect(
      LoginPage({ searchParams: Promise.resolve({ returnUrl: "/bookings" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/bookings");

    expect(mocks.redirect).toHaveBeenCalledWith("/bookings");
  });

  it("sanitizes unsafe login return URLs", () => {
    expect(loginReturnUrl("https://example.com/dashboard")).toBe("/dashboard");
    expect(loginReturnUrl("//example.com/dashboard")).toBe("/dashboard");
    expect(loginReturnUrl("/login?returnUrl=/dashboard")).toBe("/dashboard");
    expect(loginReturnUrl("/settings")).toBe("/settings");
  });

  it("renders the form for unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
    });

    render(await LoginPage({}));

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back" })
    ).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("LoginForm", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.createClient.mockClear();
    mocks.setBrowserAuthSessionPersistence.mockReset();
    window.history.pushState({}, "", "/login");
  });

  it("shows a keep-signed-in option enabled by default", () => {
    render(<LoginForm returnUrl="/dashboard" />);

    const keepSignedIn = screen.getByRole("checkbox", {
      name: "Keep me signed in",
    }) as HTMLInputElement;

    expect(keepSignedIn.checked).toBe(true);
  });

  it("signs in with a persistent session when keep signed in remains enabled", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginForm returnUrl="/dashboard" />);

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

    render(<LoginForm returnUrl="/settings" />);

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
      expect(mocks.push).toHaveBeenCalledWith("/settings");
    });
  });
});
