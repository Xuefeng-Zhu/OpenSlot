"use client";

import { Copy, Plus, Power, Trash2, Webhook } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WebhookEndpointSummary } from "@/lib/webhooks/endpoints";
import {
  webhookEventLabel,
  webhookEventOptions,
} from "@/lib/webhooks/event-types";

export interface NewWebhookSecret {
  endpointId: string;
  secretToken: string;
}

export function WebhookSecretNotice({
  secret,
  onCopy,
}: {
  secret: NewWebhookSecret;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <Label htmlFor="webhook-secret">Signing secret</Label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id="webhook-secret"
          value={secret.secretToken}
          readOnly
          className="font-mono text-xs"
        />
        <Button type="button" variant="outline" onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          Copy
        </Button>
      </div>
      <p className="mt-2 text-xs text-amber-900">
        This secret is only shown once.
      </p>
    </div>
  );
}

export function WebhookEndpointForm({
  webhookUrl,
  webhookDescription,
  webhookEvents,
  webhookCreating,
  onWebhookUrlChange,
  onWebhookDescriptionChange,
  onToggleWebhookEvent,
  onCreateWebhookEndpoint,
}: {
  webhookUrl: string;
  webhookDescription: string;
  webhookEvents: string[];
  webhookCreating: boolean;
  onWebhookUrlChange: (value: string) => void;
  onWebhookDescriptionChange: (value: string) => void;
  onToggleWebhookEvent: (eventType: string, checked: boolean) => void;
  onCreateWebhookEndpoint: () => void;
}) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Endpoint URL</Label>
          <Input
            id="webhook-url"
            type="url"
            value={webhookUrl}
            onChange={(event) => onWebhookUrlChange(event.target.value)}
            placeholder="https://example.com/webhook"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhook-description">Description</Label>
          <Input
            id="webhook-description"
            value={webhookDescription}
            onChange={(event) => onWebhookDescriptionChange(event.target.value)}
            placeholder="Production"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Events</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {webhookEventOptions.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm"
            >
              <input
                type="checkbox"
                checked={webhookEvents.includes(option.value)}
                onChange={(event) =>
                  onToggleWebhookEvent(option.value, event.target.checked)
                }
                className="h-4 w-4 rounded border-border"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <Button
        onClick={onCreateWebhookEndpoint}
        disabled={!webhookUrl.trim() || webhookCreating}
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {webhookCreating ? "Creating..." : "Add endpoint"}
      </Button>
    </>
  );
}

export function WebhookEndpointList({
  webhookEndpoints,
  webhookEndpointsLoadFailed,
  webhookActionId,
  onToggleEndpoint,
  onDeleteEndpoint,
}: {
  webhookEndpoints: WebhookEndpointSummary[];
  webhookEndpointsLoadFailed: boolean;
  webhookActionId: string | null;
  onToggleEndpoint: (
    endpoint: WebhookEndpointSummary,
    isActive: boolean
  ) => void;
  onDeleteEndpoint: (endpoint: WebhookEndpointSummary) => void;
}) {
  return (
    <div className="space-y-3">
      {webhookEndpoints.length === 0 && !webhookEndpointsLoadFailed ? (
        <EmptyState
          icon={<Webhook className="h-6 w-6" aria-hidden="true" />}
          heading="No webhook endpoints configured."
          description="Add an endpoint to receive signed booking lifecycle events in your own systems."
          className="bg-muted/30 py-10"
        />
      ) : (
        webhookEndpoints.map((endpoint) => (
          <WebhookEndpointCard
            key={endpoint.id}
            endpoint={endpoint}
            disabled={webhookActionId === endpoint.id}
            onToggle={(nextIsActive) =>
              onToggleEndpoint(endpoint, nextIsActive)
            }
            onDelete={() => onDeleteEndpoint(endpoint)}
          />
        ))
      )}
    </div>
  );
}

function WebhookEndpointCard({
  endpoint,
  disabled,
  onToggle,
  onDelete,
}: {
  endpoint: WebhookEndpointSummary;
  disabled: boolean;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-all font-mono text-xs text-foreground">
              {endpoint.url}
            </p>
            <Badge variant={endpoint.isActive ? "default" : "secondary"}>
              {endpoint.isActive ? "Active" : "Paused"}
            </Badge>
          </div>
          {endpoint.description && (
            <p className="text-sm text-muted-foreground">
              {endpoint.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            {endpoint.subscribedEvents.map((eventType) => (
              <Badge key={eventType} variant="secondary">
                {webhookEventLabel(eventType)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onToggle(!endpoint.isActive)}
          >
            <Power className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            {endpoint.isActive ? "Pause" : "Enable"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
