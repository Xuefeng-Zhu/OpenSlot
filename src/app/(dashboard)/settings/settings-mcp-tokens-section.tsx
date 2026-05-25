"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
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

export function SettingsMcpTokensSection({
  mcpTokens: initialMcpTokens,
  mcpTokensLoadFailed = false,
}: SettingsMcpTokensSectionProps) {
  const { toast } = useToast();
  const [mcpTokens, setMcpTokens] = useState(initialMcpTokens);
  const [mcpTokenName, setMcpTokenName] = useState("");
  const [mcpCreating, setMcpCreating] = useState(false);
  const [mcpActionId, setMcpActionId] = useState<string | null>(null);
  const [newMcpToken, setNewMcpToken] = useState<string | null>(null);

  const createMcpToken = async () => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          MCP API tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {mcpTokensLoadFailed ? (
          <IntegrationLoadWarning>
            MCP tokens could not be loaded. Existing tokens may not appear here.
          </IntegrationLoadWarning>
        ) : null}

        {newMcpToken && (
          <McpTokenSecretNotice rawToken={newMcpToken} onCopy={copyMcpToken} />
        )}

        <McpTokenCreateForm
          mcpCreating={mcpCreating}
          mcpTokenName={mcpTokenName}
          onCreateMcpToken={createMcpToken}
          onMcpTokenNameChange={setMcpTokenName}
        />

        <McpTokenList
          mcpActionId={mcpActionId}
          mcpTokens={mcpTokens}
          mcpTokensLoadFailed={mcpTokensLoadFailed}
          onRevokeMcpToken={revokeMcpToken}
        />
      </CardContent>
    </Card>
  );
}
