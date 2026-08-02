"use client";

import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { McpTokenSummary } from "@/lib/mcp/tokens";
import { useDashboardDisplayPreferences } from "@/components/dashboard/display-preferences-provider";
import { formatDashboardTimestamp } from "@/lib/dashboard/display-preferences";

export function McpTokenSecretNotice({
  rawToken,
  onCopy,
}: {
  rawToken: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <Label htmlFor="mcp-token">MCP token</Label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id="mcp-token"
          value={rawToken}
          readOnly
          className="font-mono text-xs"
        />
        <Button type="button" variant="outline" onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          Copy
        </Button>
      </div>
      <p className="mt-2 text-xs text-amber-900">
        This token is only shown once.
      </p>
    </div>
  );
}

export function McpTokenCreateForm({
  disabled = false,
  mcpCreating,
  mcpTokenName,
  onCreateMcpToken,
  onMcpTokenNameChange,
}: {
  disabled?: boolean;
  mcpCreating: boolean;
  mcpTokenName: string;
  onCreateMcpToken: () => void;
  onMcpTokenNameChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-2">
        <Label htmlFor="mcp-token-name">Token name</Label>
        <Input
          id="mcp-token-name"
          value={mcpTokenName}
          disabled={disabled}
          onChange={(event) => onMcpTokenNameChange(event.target.value)}
          placeholder="Claude Desktop"
        />
      </div>
      <div className="flex items-end">
        <Button
          onClick={onCreateMcpToken}
          disabled={disabled || mcpCreating}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {mcpCreating ? "Creating..." : "Create token"}
        </Button>
      </div>
    </div>
  );
}

export function McpTokenList({
  actionsDisabled = false,
  mcpActionId,
  mcpTokens,
  mcpTokensLoadFailed,
  onRevokeMcpToken,
}: {
  actionsDisabled?: boolean;
  mcpActionId: string | null;
  mcpTokens: McpTokenSummary[];
  mcpTokensLoadFailed: boolean;
  onRevokeMcpToken: (token: McpTokenSummary) => void;
}) {
  return (
    <div className="space-y-3">
      {mcpTokens.length === 0 && !mcpTokensLoadFailed ? (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" aria-hidden="true" />}
          heading="No MCP tokens configured."
          description="Create a token to connect OpenSlot to an MCP-compatible client."
          className="bg-muted/30 py-10"
        />
      ) : (
        mcpTokens.map((token) => (
          <McpTokenCard
            key={token.id}
            token={token}
            disabled={
              actionsDisabled ||
              mcpActionId === token.id ||
              Boolean(token.revokedAt) ||
              isMcpTokenExpired(token)
            }
            onRevoke={() => onRevokeMcpToken(token)}
          />
        ))
      )}
    </div>
  );
}

function McpTokenCard({
  token,
  disabled,
  onRevoke,
}: {
  token: McpTokenSummary;
  disabled: boolean;
  onRevoke: () => void;
}) {
  const isRevoked = Boolean(token.revokedAt);
  const isExpired = isMcpTokenExpired(token);
  const displayPreferences = useDashboardDisplayPreferences();

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{token.name}</p>
            <Badge variant={isRevoked || isExpired ? "secondary" : "default"}>
              {isRevoked ? "Revoked" : isExpired ? "Expired" : "Active"}
            </Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {token.tokenPrefix}...
          </p>
          <p className="text-xs text-muted-foreground">
            Last used{" "}
            {token.lastUsedAt
              ? formatDashboardTimestamp(token.lastUsedAt, displayPreferences)
              : "never"}{" "}
            · Created{" "}
            {formatDashboardTimestamp(token.createdAt, displayPreferences)}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onRevoke}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Revoke
        </Button>
      </div>
    </div>
  );
}

function isMcpTokenExpired(token: McpTokenSummary): boolean {
  return Boolean(token.expiresAt && new Date(token.expiresAt) <= new Date());
}
