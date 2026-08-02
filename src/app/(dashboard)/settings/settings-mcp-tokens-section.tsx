"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { copyTextToClipboard } from "@/lib/utils/clipboard";
import type { McpTokenSummary } from "@/lib/mcp/tokens";
import { IntegrationLoadWarning } from "./settings-integration-load-warning";
import {
  McpTokenCreateForm,
  McpTokenList,
  McpTokenSecretNotice,
} from "./settings-mcp-token-panels";

interface SettingsMcpTokensSectionProps {
  mcpTokens: McpTokenSummary[];
  mcpTokensLoadFailed?: boolean;
}

type McpTokenCreateResponse =
  | {
      success: true;
      rawToken: string;
      token: McpTokenSummary;
    }
  | {
      success: false;
      error?: string;
    };

type McpTokenMutationResponse =
  | {
      success: true;
    }
  | {
      success: false;
      error?: string;
    };

type McpTokenListResponse =
  | {
      success: true;
      tokens: McpTokenSummary[];
    }
  | {
      success: false;
      error?: string;
      code?: string;
    };

type McpTokenLoadState = "error" | "retrying" | "ready";

export function SettingsMcpTokensSection({
  mcpTokens: initialMcpTokens,
  mcpTokensLoadFailed = false,
}: SettingsMcpTokensSectionProps) {
  const { toast } = useToast();
  const [mcpTokens, setMcpTokens] = useState(initialMcpTokens);
  const [mcpTokenLoadState, setMcpTokenLoadState] =
    useState<McpTokenLoadState>(mcpTokensLoadFailed ? "error" : "ready");
  const [mcpTokenName, setMcpTokenName] = useState("");
  const [mcpCreating, setMcpCreating] = useState(false);
  const [mcpActionId, setMcpActionId] = useState<string | null>(null);
  const [newMcpToken, setNewMcpToken] = useState<string | null>(null);
  const mcpTokenListReady = mcpTokenLoadState === "ready";

  const createMcpToken = async () => {
    if (!mcpTokenListReady) return;

    setMcpCreating(true);
    setNewMcpToken(null);

    try {
      const data = await requestJson<McpTokenCreateResponse>(
        "/api/mcp/tokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: mcpTokenName.trim() || "MCP client",
          }),
        },
        "Failed to create MCP token"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to create MCP token");
      }
      if (!data.token || !data.rawToken) {
        throw new Error("Failed to create MCP token");
      }

      setMcpTokens((current) => [data.token, ...current]);
      setMcpTokenName("");
      setNewMcpToken(data.rawToken);
      toast({
        title: "MCP token created",
        description: "The token is shown once.",
      });
    } catch (error) {
      toast({
        title: "MCP token not created",
        description: errorToastDescription(error),
        variant: "destructive",
      });
    } finally {
      setMcpCreating(false);
    }
  };

  const revokeMcpToken = async (token: McpTokenSummary) => {
    if (!mcpTokenListReady) return;

    if (!window.confirm("Revoke this MCP token?")) {
      return;
    }

    setMcpActionId(token.id);

    try {
      const data = await requestJson<McpTokenMutationResponse>(
        `/api/mcp/tokens/${token.id}`,
        { method: "DELETE" },
        "Failed to revoke MCP token"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to revoke MCP token");
      }

      const revokedAt = new Date().toISOString();
      setMcpTokens((current) =>
        current.map((item) =>
          item.id === token.id
            ? { ...item, revokedAt, updatedAt: revokedAt }
            : item
        )
      );
      setNewMcpToken(null);
    } catch (error) {
      toast({
        title: "MCP token not revoked",
        description: errorToastDescription(error),
        variant: "destructive",
      });
    } finally {
      setMcpActionId(null);
    }
  };

  const copyMcpToken = async () => {
    if (!newMcpToken) return;

    try {
      await copyTextToClipboard(newMcpToken);
      toast({
        title: "Token copied",
        description: "Use it as a Bearer token for /api/mcp.",
      });
    } catch {
      toast({
        title: "Token not copied",
        description: "Select the value and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const retryMcpTokens = async () => {
    setMcpTokenLoadState("retrying");

    try {
      const data = await requestJson<McpTokenListResponse>(
        "/api/mcp/tokens",
        { method: "GET" },
        "Failed to load MCP tokens"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to load MCP tokens");
      }

      if (!Array.isArray(data.tokens)) {
        throw new Error("Failed to load MCP tokens");
      }

      setMcpTokens(data.tokens);
      setNewMcpToken(null);
      setMcpTokenLoadState("ready");
      toast({
        title: "MCP tokens loaded",
        description: "Token actions are available again.",
      });
    } catch (error) {
      setMcpTokenLoadState("error");
      toast({
        title: "MCP tokens not loaded",
        description: errorToastDescription(error),
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          MCP API tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!mcpTokenListReady ? (
          <IntegrationLoadWarning>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {mcpTokenLoadState === "retrying"
                  ? "Retrying MCP token loading. Token actions remain unavailable."
                  : "MCP tokens could not be loaded. Token actions are unavailable until the full list is restored."}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={mcpTokenLoadState === "retrying"}
                onClick={retryMcpTokens}
              >
                {mcpTokenLoadState === "retrying"
                  ? "Retrying..."
                  : "Retry MCP tokens"}
              </Button>
            </div>
          </IntegrationLoadWarning>
        ) : null}

        {newMcpToken && (
          <McpTokenSecretNotice rawToken={newMcpToken} onCopy={copyMcpToken} />
        )}

        <McpTokenCreateForm
          disabled={!mcpTokenListReady}
          mcpCreating={mcpCreating}
          mcpTokenName={mcpTokenName}
          onCreateMcpToken={createMcpToken}
          onMcpTokenNameChange={setMcpTokenName}
        />

        <McpTokenList
          actionsDisabled={!mcpTokenListReady}
          mcpActionId={mcpActionId}
          mcpTokens={mcpTokens}
          mcpTokensLoadFailed={!mcpTokenListReady}
          onRevokeMcpToken={revokeMcpToken}
        />
      </CardContent>
    </Card>
  );
}
