import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsMcpTokensSection } from "../settings-mcp-tokens-section";
import type { McpTokenSummary } from "@/lib/mcp/tokens";

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const token: McpTokenSummary = {
  id: "token-1",
  name: "Claude Desktop",
  tokenPrefix: "os_mcp_abcd1234",
  scopes: ["mcp:read", "mcp:write"],
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: "2026-05-24T00:00:00.000Z",
  updatedAt: "2026-05-24T00:00:00.000Z",
};

describe("SettingsMcpTokensSection", () => {
  beforeEach(() => {
    toastMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables token mutations until retry restores the complete list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, tokens: [token] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsMcpTokensSection
        mcpTokens={[token]}
        mcpTokensLoadFailed
      />
    );

    expect(
      (screen.getByLabelText("Token name") as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Create token" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Revoke" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Retry MCP tokens" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/mcp/tokens", {
        method: "GET",
      });
      expect(
        (
          screen.getByRole("button", {
            name: "Create token",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false);
    });

    expect(screen.queryByRole("button", { name: "Retry MCP tokens" })).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "MCP tokens loaded" })
    );
  });

  it("keeps mutations disabled when retry fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "MCP tokens are temporarily unavailable",
          code: "MCP_TOKENS_UNAVAILABLE",
        }),
      })
    );

    render(
      <SettingsMcpTokensSection mcpTokens={[]} mcpTokensLoadFailed />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Retry MCP tokens" })
    );

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "Create token" }) as HTMLButtonElement)
          .disabled
      ).toBe(true);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "MCP tokens not loaded",
          variant: "destructive",
        })
      );
    });

    expect(screen.queryByText("No MCP tokens configured.")).toBeNull();
  });
});
