"use client";

import { useState } from "react";
import { Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { copyTextToClipboard } from "@/lib/utils/clipboard";
import type { WebhookEndpointSummary } from "@/lib/webhooks/endpoints";
import {
  type NewWebhookSecret,
  WebhookEndpointForm,
  WebhookEndpointList,
  WebhookSecretNotice,
} from "./settings-webhook-endpoint-panels";
import { IntegrationLoadWarning } from "./settings-integration-load-warning";

interface SettingsWebhookEndpointsSectionProps {
  webhookEndpoints: WebhookEndpointSummary[];
  webhookEndpointsLoadFailed?: boolean;
}

type WebhookEndpointCreateResponse =
  | {
      success: true;
      endpoint: WebhookEndpointSummary;
      secretToken: string;
    }
  | {
      success: false;
      error?: string;
    };

type WebhookEndpointMutationResponse =
  | {
      success: true;
      endpoint?: WebhookEndpointSummary;
    }
  | {
      success: false;
      error?: string;
    };

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
      const data = await requestJson<WebhookEndpointCreateResponse>(
        "/api/webhooks/endpoints",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl.trim(),
            description: webhookDescription.trim() || undefined,
            subscribedEvents: webhookEvents,
          }),
        },
        "Failed to create webhook endpoint"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to create webhook endpoint");
      }

      const { endpoint, secretToken } = data;
      if (!endpoint || !secretToken) {
        throw new Error("Failed to create webhook endpoint");
      }

      setWebhookEndpoints((current) => [endpoint, ...current]);
      setWebhookUrl("");
      setWebhookDescription("");
      setWebhookEvents(["booking.confirmed"]);
      setNewWebhookSecret({
        endpointId: endpoint.id,
        secretToken,
      });
      toast({
        title: "Webhook created",
        description: "The signing secret is shown once.",
      });
    } catch (error) {
      toast({
        title: "Webhook not created",
        description: errorToastDescription(error),
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
      const data = await requestJson<WebhookEndpointMutationResponse>(
        `/api/webhooks/endpoints/${endpoint.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        },
        "Failed to update webhook endpoint"
      );

      if (!data.success) {
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
        description: errorToastDescription(error),
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
      const data = await requestJson<WebhookEndpointMutationResponse>(
        `/api/webhooks/endpoints/${endpoint.id}`,
        {
          method: "DELETE",
        },
        "Failed to delete webhook endpoint"
      );

      if (!data.success) {
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
        description: errorToastDescription(error),
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
          <WebhookSecretNotice
            secret={newWebhookSecret}
            onCopy={copyWebhookSecret}
          />
        )}

        <WebhookEndpointForm
          webhookUrl={webhookUrl}
          webhookDescription={webhookDescription}
          webhookEvents={webhookEvents}
          webhookCreating={webhookCreating}
          onWebhookUrlChange={setWebhookUrl}
          onWebhookDescriptionChange={setWebhookDescription}
          onToggleWebhookEvent={toggleWebhookEvent}
          onCreateWebhookEndpoint={createWebhookEndpoint}
        />

        <WebhookEndpointList
          webhookEndpoints={webhookEndpoints}
          webhookEndpointsLoadFailed={webhookEndpointsLoadFailed}
          webhookActionId={webhookActionId}
          onToggleEndpoint={setWebhookActive}
          onDeleteEndpoint={deleteWebhookEndpoint}
        />
      </CardContent>
    </Card>
  );
}
