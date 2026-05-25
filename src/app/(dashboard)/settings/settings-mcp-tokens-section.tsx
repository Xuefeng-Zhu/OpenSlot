"use client";

import { useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { copyTextToClipboard } from "@/lib/utils/clipboard";
import type { McpTokenSummary } from "@/lib/mcp/tokens";
import { IntegrationLoadWarning } from "./settings-integration-load-warning";

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
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <Label htmlFor="mcp-token">MCP token</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="mcp-token"
                value={newMcpToken}
                readOnly
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" onClick={copyMcpToken}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-900">
              This token is only shown once.
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <Label htmlFor="mcp-token-name">Token name</Label>
            <Input
              id="mcp-token-name"
              value={mcpTokenName}
              onChange={(event) => setMcpTokenName(event.target.value)}
              placeholder="Claude Desktop"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={createMcpToken} disabled={mcpCreating}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {mcpCreating ? "Creating..." : "Create token"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {mcpTokens.length === 0 && !mcpTokensLoadFailed ? (
            <EmptyState
              icon={<KeyRound className="h-6 w-6" aria-hidden="true" />}
              heading="No MCP tokens configured."
              description="Create a token to connect OpenSlot to an MCP-compatible client."
              className="bg-muted/30 py-10"
            />
          ) : (
            mcpTokens.map((token) => {
              const isRevoked = Boolean(token.revokedAt);
              const isExpired = isMcpTokenExpired(token);

              return (
                <div
                  key={token.id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{token.name}</p>
                        <Badge
                          variant={
                            isRevoked || isExpired ? "secondary" : "default"
                          }
                        >
                          {isRevoked
                            ? "Revoked"
                            : isExpired
                              ? "Expired"
                              : "Active"}
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {token.tokenPrefix}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last used {formatTokenDate(token.lastUsedAt)} · Created{" "}
                        {formatTokenDate(token.createdAt)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        mcpActionId === token.id || isRevoked || isExpired
                      }
                      onClick={() => revokeMcpToken(token)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function isMcpTokenExpired(token: McpTokenSummary): boolean {
  return Boolean(token.expiresAt && new Date(token.expiresAt) <= new Date());
}

function formatTokenDate(value: string | null): string {
  if (!value) return "never";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
