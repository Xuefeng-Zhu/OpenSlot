import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "../settings-client";

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/backend/compat/browser-client", () => ({
  createBrowserBackendClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
  }),
}));

const initialSettings = {
  name: "Test User",
  email: "test@example.com",
  defaultTimezone: "America/Los_Angeles",
  dateFormat: "MM/DD/YYYY" as const,
  timeFormat: "12h" as const,
  notifyNewBooking: true,
  notifyCancellation: true,
  notifyReminder: false,
};

describe("SettingsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    toastMock.mockClear();
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

<<<<<<< HEAD
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

    fireEvent.click(screen.getByRole("tab", { name: "Preferences" }));
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
