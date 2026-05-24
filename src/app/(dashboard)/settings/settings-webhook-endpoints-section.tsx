"use client";

import { useState } from "react";
import { Copy, Plus, Power, Trash2, Webhook } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { copyTextToClipboard } from "@/lib/utils/clipboard";
import type { WebhookEndpointSummary } from "@/lib/webhooks/endpoints";
import { IntegrationLoadWarning } from "./settings-integration-load-warning";

interface SettingsWebhookEndpointsSectionProps {
  webhookEndpoints: WebhookEndpointSummary[];
  webhookEndpointsLoadFailed?: boolean;
}

const webhookEventOptions = [
  { value: "booking.confirmed", label: "Confirmed" },
  { value: "booking.cancelled", label: "Cancelled" },
  { value: "booking.rescheduled", label: "Rescheduled" },
  { value: "*", label: "All" },
] as const;

interface NewWebhookSecret {
  endpointId: string;
  secretToken: string;
}

export function SettingsWebhookEndpointsSection({
  webhookEndpoints: initialWebhookEndpoints,
  webhookEndpointsLoadFailed = false,
}: SettingsWebhookEndpointsSectionProps) {
  const { toast } = useToast();
  const [webhookEndpoints, setWebhookEndpoints] = useState(
    initialWebhookEndpoints
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDescription, setWebhookDescription] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    "booking.confirmed",
  ]);
  const [webhookCreating, setWebhookCreating] = useState(false);
  const [webhookActionId, setWebhookActionId] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] =
    useState<NewWebhookSecret | null>(null);

  const toggleWebhookEvent = (eventType: string, checked: boolean) => {
    setWebhookEvents((current) => {
      if (checked) {
        return Array.from(new Set([...current, eventType]));
      }

      const next = current.filter((event) => event !== eventType);
      return next.length > 0 ? next : current;
    });
  };

  const createWebhookEndpoint = async () => {
    setWebhookCreating(true);
    setNewWebhookSecret(null);

    try {
      const response = await fetch("/api/webhooks/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          description: webhookDescription.trim() || undefined,
          subscribedEvents: webhookEvents,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to create webhook endpoint");
      }

      setWebhookEndpoints((current) => [data.endpoint, ...current]);
      setWebhookUrl("");
      setWebhookDescription("");
      setWebhookEvents(["booking.confirmed"]);
      setNewWebhookSecret({
        endpointId: data.endpoint.id,
        secretToken: data.secretToken,
      });
      toast({
        title: "Webhook created",
        description: "The signing secret is shown once.",
      });
    } catch (error) {
      toast({
        title: "Webhook not created",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWebhookCreating(false);
    }
  };

  const setWebhookActive = async (
    endpoint: WebhookEndpointSummary,
    isActive: boolean
  ) => {
    setWebhookActionId(endpoint.id);

    try {
      const response = await fetch(`/api/webhooks/endpoints/${endpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to update webhook endpoint");
      }

      setWebhookEndpoints((current) =>
        current.map((item) =>
          item.id === endpoint.id ? { ...item, isActive } : item
        )
      );
    } catch (error) {
      toast({
        title: "Webhook not updated",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWebhookActionId(null);
    }
  };

  const deleteWebhookEndpoint = async (endpoint: WebhookEndpointSummary) => {
    if (!window.confirm("Delete this webhook endpoint?")) {
      return;
    }

    setWebhookActionId(endpoint.id);

    try {
      const response = await fetch(`/api/webhooks/endpoints/${endpoint.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to delete webhook endpoint");
      }

      setWebhookEndpoints((current) =>
        current.filter((item) => item.id !== endpoint.id)
      );
      setNewWebhookSecret((current) =>
        current?.endpointId === endpoint.id ? null : current
      );
    } catch (error) {
      toast({
        title: "Webhook not deleted",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWebhookActionId(null);
    }
  };

  const copyWebhookSecret = async () => {
    if (!newWebhookSecret) return;

    try {
      await copyTextToClipboard(newWebhookSecret.secretToken);
      toast({
        title: "Secret copied",
        description: "Use it to verify OpenSlot webhook signatures.",
      });
    } catch {
      toast({
        title: "Secret not copied",
        description: "Select the value and copy it manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Webhook className="h-4 w-4" aria-hidden="true" />
          Webhook endpoints
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {webhookEndpointsLoadFailed ? (
          <IntegrationLoadWarning>
            Webhook endpoints could not be loaded. Existing endpoints may not
            appear here.
          </IntegrationLoadWarning>
        ) : null}

        {newWebhookSecret && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <Label htmlFor="webhook-secret">Signing secret</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="webhook-secret"
                value={newWebhookSecret.secretToken}
                readOnly
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" onClick={copyWebhookSecret}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-900">
              This secret is only shown once.
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-description">Description</Label>
            <Input
              id="webhook-description"
              value={webhookDescription}
              onChange={(event) => setWebhookDescription(event.target.value)}
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
                    toggleWebhookEvent(option.value, event.target.checked)
                  }
                  className="h-4 w-4 rounded border-border"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <Button
          onClick={createWebhookEndpoint}
          disabled={!webhookUrl.trim() || webhookCreating}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {webhookCreating ? "Creating..." : "Add endpoint"}
        </Button>

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
                  setWebhookActive(endpoint, nextIsActive)
                }
                onDelete={() => deleteWebhookEndpoint(endpoint)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
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

function webhookEventLabel(eventType: string): string {
  return (
    webhookEventOptions.find((option) => option.value === eventType)?.label ??
    eventType
  );
}
