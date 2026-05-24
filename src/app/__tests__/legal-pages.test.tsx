import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import SignupPage from "@/app/(auth)/signup/page";
import TermsPage from "@/app/terms/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/backend/compat/browser-client", () => ({
  createBrowserBackendClient: () => ({
    auth: {
      signUp: vi.fn(),
    },
  }),
}));

describe("legal pages", () => {
  it("renders the terms route linked from signup", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" })
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to OpenSlot" }).getAttribute("href")).toBe(
      "/"
    );
  });

  it("renders the privacy route linked from signup", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" })
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to OpenSlot" }).getAttribute("href")).toBe(
      "/"
    );
  });

  it("keeps signup legal links pointed at rendered routes", () => {
    render(<SignupPage />);

    expect(
      screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")
    ).toBe("/terms");
    expect(
      screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")
    ).toBe("/privacy");
  });
});
