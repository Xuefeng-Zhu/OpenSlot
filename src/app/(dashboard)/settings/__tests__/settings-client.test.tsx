import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "../settings-client";

expect.extend(toHaveNoViolations);

const toastMock = vi.hoisted(() => vi.fn());
const routerMock = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));
const backendAuthMock = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/backend/compat/browser-client", () => ({
  createBrowserBackendClient: () => ({
    auth: backendAuthMock,
  }),
}));

const initialSettings = {
  email: "test@example.com",
  defaultTimezone: "America/Los_Angeles",
  dateFormat: "MM/DD/YYYY" as const,
  timeFormat: "12h" as const,
  notifyNewBooking: true,
  notifyCancellation: true,
  notifyReminder: false,
};

const dirtySectionCases = [
  {
    section: "preferences",
    tabName: "Preferences",
    saveButtonName: "Save preferences",
  },
  {
    section: "notifications",
    tabName: "Notifications",
    saveButtonName: "Save notification settings",
  },
] as const;

type DirtySection = (typeof dirtySectionCases)[number]["section"];

function selectSettingsSection(tabName: string) {
  fireEvent.click(
    screen.getByRole("tab", { name: new RegExp(`^${tabName}`) })
  );
}

function toggleSectionDraft(section: DirtySection) {
  if (section === "preferences") {
    const dateFormat = screen.getByLabelText(
      "Date format"
    ) as HTMLSelectElement;
    fireEvent.change(dateFormat, {
      target: {
        value:
          dateFormat.value === initialSettings.dateFormat
            ? "DD/MM/YYYY"
            : initialSettings.dateFormat,
      },
    });
    return;
  }

  fireEvent.click(
    screen.getByRole("switch", { name: "Toggle cancellation notifications" })
  );
}

function renderSettingsClient() {
  return render(
    <SettingsClient
      initialSettings={initialSettings}
      calendarConnections={[]}
      webhookEndpoints={[]}
    />
  );
}

describe("SettingsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    toastMock.mockClear();
    routerMock.refresh.mockReset();
    routerMock.replace.mockReset();
    backendAuthMock.signOut.mockReset();
  });

  it("opens a deep-linked settings tab and keeps tab selection in the URL", () => {
    render(
      <SettingsClient
        initialSettings={initialSettings}
        initialTab="preferences"
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    expect(
      screen
        .getByRole("tab", { name: "Preferences" })
        .getAttribute("aria-selected")
    ).toBe("true");
    expect(screen.getByLabelText("Default timezone")).toBeDefined();

    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    expect(routerMock.replace).toHaveBeenCalledWith(
      "/settings?tab=integrations",
      { scroll: false }
    );
  });

  it("announces a successful calendar callback once and clears result parameters", async () => {
    render(
      <SettingsClient
        initialSettings={initialSettings}
        initialTab="integrations"
        calendarOAuthResult={{ status: "connected", provider: "google" }}
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Google Calendar connected",
        description: "Calendar availability and booking sync are ready.",
      });
      expect(routerMock.replace).toHaveBeenCalledWith(
        "/settings?tab=integrations",
        { scroll: false }
      );
    });
  });

  it("uses safe retry guidance for failed calendar callbacks", async () => {
    render(
      <SettingsClient
        initialSettings={initialSettings}
        initialTab="integrations"
        calendarOAuthResult={{
          status: "error",
          provider: "microsoft",
          reason: "provider_unavailable",
        }}
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Calendar not connected",
        description:
          "The calendar provider is temporarily unavailable. Try again shortly.",
        variant: "destructive",
      });
    });
  });

  it("clears ignored legacy calendar errors without exposing or announcing them", async () => {
    render(
      <SettingsClient
        initialSettings={initialSettings}
        initialTab="integrations"
        clearIgnoredCalendarOAuthResult
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        "/settings?tab=integrations",
        { scroll: false }
      );
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("shows the canonical login email without an email save path", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderSettingsClient();

    const emailInput = screen.getByLabelText(
      "Login email"
    ) as HTMLInputElement;
    expect(emailInput.value).toBe(initialSettings.email);
    expect(emailInput.readOnly).toBe(true);
    expect(emailInput.getAttribute("aria-describedby")).toBe(
      "settings-email-description"
    );
    expect(
      screen.getByText(/canonical email from your sign-in account/)
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Save email" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Account" })).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes password changes to the reset-code flow", () => {
    renderSettingsClient();

    const resetLink = screen.getByRole("link", { name: "Reset password" });
    expect(resetLink.getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByText(/verified reset-code flow/)).toBeDefined();
    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("has no detectable accessibility violations in the account settings tab", async () => {
    const { container } = renderSettingsClient();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("preserves confirmed account deletion and signs out afterward", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    backendAuthMock.signOut.mockResolvedValue({ error: null });
    renderSettingsClient();

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
        method: "DELETE",
      });
      expect(backendAuthMock.signOut).toHaveBeenCalledTimes(1);
    });
  });

  it.each(dirtySectionCases)(
    "clears the $section dirty baseline after its save succeeds",
    async ({ section, tabName, saveButtonName }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
      );
      renderSettingsClient();
      selectSettingsSection(tabName);
      toggleSectionDraft(section);

      expect(
        screen.getByRole("tab", {
          name: `${tabName}, unsaved changes`,
        })
      ).toBeDefined();
      fireEvent.click(
        screen.getByRole("button", { name: saveButtonName })
      );

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: tabName })).toBeDefined();
        expect(
          (
            screen.getByRole("button", {
              name: saveButtonName,
            }) as HTMLButtonElement
          ).disabled
        ).toBe(true);
      });
    }
  );

  it.each(dirtySectionCases)(
    "retains the $section dirty baseline after its save fails",
    async ({ section, tabName, saveButtonName }) => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: "Save unavailable" }),
      });
      vi.stubGlobal("fetch", fetchMock);
      renderSettingsClient();
      selectSettingsSection(tabName);
      toggleSectionDraft(section);
      fireEvent.click(
        screen.getByRole("button", { name: saveButtonName })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(
          screen.getByRole("tab", {
            name: `${tabName}, unsaved changes`,
          })
        ).toBeDefined();
        expect(
          (
            screen.getByRole("button", {
              name: saveButtonName,
            }) as HTMLButtonElement
          ).disabled
        ).toBe(false);
      });
    }
  );

  it.each(dirtySectionCases)(
    "clears the $section dirty baseline when its draft is reverted",
    ({ section, tabName, saveButtonName }) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderSettingsClient();
      selectSettingsSection(tabName);
      toggleSectionDraft(section);
      toggleSectionDraft(section);

      expect(screen.getByRole("tab", { name: tabName })).toBeDefined();
      expect(
        (screen.getByRole("button", {
          name: saveButtonName,
        }) as HTMLButtonElement).disabled
      ).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("keeps preference drafts out of notification saves", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Preferences" }));
    fireEvent.change(screen.getByLabelText("Date format"), {
      target: { value: "DD/MM/YYYY" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Notifications" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "Toggle cancellation notifications" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save notification settings" })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(options.body as string)).toEqual({
      section: "notifications",
      notifyNewBooking: true,
      notifyCancellation: false,
      notifyReminder: false,
    });
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(
      screen.getByRole("tab", { name: "Preferences, unsaved changes" })
    ).toBeDefined();
    expect(
      screen.getByRole("tab", { name: "Notifications" })
    ).toBeDefined();
  });

  it("clears a one-time webhook secret after deleting that endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          secretToken: "secret-token",
          endpoint: {
            id: "endpoint-1",
            url: "https://example.com/webhook",
            description: "QA endpoint",
            subscribedEvents: ["booking.confirmed"],
            isActive: true,
            createdAt: "2026-05-08T00:00:00.000Z",
            updatedAt: "2026-05-08T00:00:00.000Z",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "https://example.com/webhook" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "QA endpoint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));

    expect(await screen.findByLabelText("Signing secret")).toBeDefined();
    expect(screen.getByText("https://example.com/webhook")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("https://example.com/webhook")).toBeNull();
    });

    expect(screen.queryByLabelText("Signing secret")).toBeNull();
    expect(screen.getByText("No webhook endpoints configured.")).toBeDefined();
  });

  it("keeps a new webhook secret visible when deleting another endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          secretToken: "secret-token",
          endpoint: {
            id: "endpoint-new",
            url: "https://new.example.com/webhook",
            description: "New endpoint",
            subscribedEvents: ["booking.confirmed"],
            isActive: true,
            createdAt: "2026-05-08T00:00:00.000Z",
            updatedAt: "2026-05-08T00:00:00.000Z",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        webhookEndpoints={[
          {
            id: "endpoint-existing",
            url: "https://existing.example.com/webhook",
            description: "Existing endpoint",
            subscribedEvents: ["booking.cancelled"],
            isActive: true,
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "https://new.example.com/webhook" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "New endpoint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));

    expect(await screen.findByDisplayValue("secret-token")).toBeDefined();
    expect(screen.getByText("https://existing.example.com/webhook")).toBeDefined();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);

    await waitFor(() => {
      expect(
        screen.queryByText("https://existing.example.com/webhook")
      ).toBeNull();
    });

    expect(screen.getByDisplayValue("secret-token")).toBeDefined();
    expect(screen.getByText("https://new.example.com/webhook")).toBeDefined();
  });

  it("shows manual copy feedback when webhook secret clipboard copy is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        secretToken: "secret-token",
        endpoint: {
          id: "endpoint-1",
          url: "https://example.com/webhook",
          description: "QA endpoint",
          subscribedEvents: ["booking.confirmed"],
          isActive: true,
          createdAt: "2026-05-08T00:00:00.000Z",
          updatedAt: "2026-05-08T00:00:00.000Z",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: vi.fn(() => false),
      configurable: true,
    });

    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "https://example.com/webhook" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "QA endpoint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));

    await screen.findByLabelText("Signing secret");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Secret not copied",
          description: "Select the value and copy it manually.",
          variant: "destructive",
        })
      );
    });
  });

  it("surfaces integration load failures without empty configured states", () => {
    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        calendarConnectionsLoadFailed
        webhookEndpoints={[]}
        webhookEndpointsLoadFailed
        mcpTokensLoadFailed
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));

    expect(
      screen.getByText(/Calendar connection status could not be loaded/)
    ).toBeDefined();
    expect(
      screen.getByText(/Webhook endpoints could not be loaded/)
    ).toBeDefined();
    expect(screen.getByText(/MCP tokens could not be loaded/)).toBeDefined();
    expect(screen.queryByText("No webhook endpoints configured.")).toBeNull();
    expect(screen.queryByText("No MCP tokens configured.")).toBeNull();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(
      2
    );
  });

  it("shows the settings save fallback when the API returns non-JSON errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error("Unexpected token");
        },
      })
    );

    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        webhookEndpoints={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Preferences" }));
    fireEvent.change(screen.getByLabelText("Date format"), {
      target: { value: "DD/MM/YYYY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Settings not saved",
          description: "Failed to save settings",
          variant: "destructive",
        })
      );
    });
  });

  it("creates and revokes MCP tokens without storing the raw token in the list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          rawToken: "os_mcp_raw-token",
          token: {
            id: "token-1",
            name: "Claude Desktop",
            tokenPrefix: "os_mcp_abcd1234",
            scopes: ["mcp:read", "mcp:write"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
            createdAt: "2026-05-24T00:00:00.000Z",
            updatedAt: "2026-05-24T00:00:00.000Z",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SettingsClient
        initialSettings={initialSettings}
        calendarConnections={[]}
        webhookEndpoints={[]}
        mcpTokens={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    fireEvent.change(screen.getByLabelText("Token name"), {
      target: { value: "Claude Desktop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(
      (await screen.findByLabelText("MCP token") as HTMLInputElement).value
    ).toBe("os_mcp_raw-token");
    expect(screen.getByText("Claude Desktop")).toBeDefined();
    expect(screen.getByText("os_mcp_abcd1234...")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/mcp/tokens/token-1", {
        method: "DELETE",
      });
    });

    expect(screen.getByText("Revoked")).toBeDefined();
  });
});
