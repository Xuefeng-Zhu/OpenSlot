"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  Calendar,
  CreditCard,
  Mail,
  Puzzle,
  RefreshCw,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import {
  getVideoProviderReadiness,
  type VideoProviderReadiness,
  videoProviderOptions,
} from "@/lib/calendar/video-providers";
import type { WebhookEndpointSummary } from "@/lib/webhooks/endpoints";
import { IntegrationLoadWarning } from "./settings-integration-load-warning";
import { SettingsWebhookEndpointsSection } from "./settings-webhook-endpoints-section";

interface SettingsIntegrationsTabProps {
  calendarConnections: CalendarConnectionSummary[];
  calendarConnectionsLoadFailed?: boolean;
  webhookEndpoints: WebhookEndpointSummary[];
  webhookEndpointsLoadFailed?: boolean;
}

export function SettingsIntegrationsTab({
  calendarConnections,
  calendarConnectionsLoadFailed = false,
  webhookEndpoints: initialWebhookEndpoints,
  webhookEndpointsLoadFailed = false,
}: SettingsIntegrationsTabProps) {
  const googleConnection = calendarConnections.find(
    (connection) => connection.provider === "google"
  );
  const microsoftConnection = calendarConnections.find(
    (connection) => connection.provider === "microsoft"
  );
  const videoProviderReadiness = calendarConnectionsLoadFailed
    ? []
    : videoProviderOptions.map((provider) =>
        getVideoProviderReadiness(provider.id, calendarConnections)
      );

  return (
    <TabsContent value="integrations">
      <div className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Puzzle className="h-4 w-4" aria-hidden="true" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {calendarConnectionsLoadFailed ? (
              <IntegrationLoadWarning>
                Calendar connection status could not be loaded. Existing
                connections may not appear here.
              </IntegrationLoadWarning>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CalendarConnectionCard
                icon={<Calendar className="h-5 w-5 text-accent-foreground" />}
                label="Google Calendar"
                description="Sync your bookings"
                connection={googleConnection}
                loadFailed={calendarConnectionsLoadFailed}
                connectHref="/api/calendar/oauth/google/start"
              />
              <CalendarConnectionCard
                icon={<Mail className="h-5 w-5 text-accent-foreground" />}
                label="Microsoft Outlook"
                description="Sync your calendar"
                connection={microsoftConnection}
                loadFailed={calendarConnectionsLoadFailed}
                connectHref="/api/calendar/oauth/microsoft/start"
              />

              {calendarConnectionsLoadFailed ? (
                <UnavailableVideoProviderCard />
              ) : (
                videoProviderReadiness.map((health) => (
                  <VideoProviderCard key={health.provider} health={health} />
                ))
              )}

              <StaticIntegrationCard
                icon={<CreditCard className="h-5 w-5 text-accent-foreground" />}
                label="Stripe"
                description="Accept payments"
                badge="Available soon"
              />
            </div>
          </CardContent>
        </Card>

        <SettingsWebhookEndpointsSection
          webhookEndpoints={initialWebhookEndpoints}
          webhookEndpointsLoadFailed={webhookEndpointsLoadFailed}
        />
      </div>
    </TabsContent>
  );
}

function CalendarConnectionCard({
  icon,
  label,
  description,
  connection,
  loadFailed,
  connectHref,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  connection: CalendarConnectionSummary | undefined;
  loadFailed: boolean;
  connectHref: string;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <IntegrationIcon>{icon}</IntegrationIcon>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant={connection ? "default" : "secondary"}>
          {connectionBadgeText(connection, loadFailed)}
        </Badge>
      </div>
      {connection && (
        <p className="mt-3 text-xs text-muted-foreground">
          {connection.accountEmail} · {connection.calendars.length} calendars
        </p>
      )}
      <Button
        asChild
        variant={connection ? "outline" : "default"}
        size="sm"
        className="mt-4"
      >
        <Link href={connectHref} prefetch={false}>
          {connection && (
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          )}
          {connection ? "Reconnect" : "Connect"}
        </Link>
      </Button>
    </div>
  );
}

function UnavailableVideoProviderCard() {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <IntegrationIcon>
            <Video className="h-5 w-5 text-accent-foreground" />
          </IntegrationIcon>
          <div>
            <p className="text-sm font-medium">Video provider readiness</p>
            <p className="text-xs text-muted-foreground">
              Generated meeting links
            </p>
          </div>
        </div>
        <Badge variant="secondary">Unavailable</Badge>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Calendar connection status did not load, so video link readiness cannot
        be verified.
      </p>
    </div>
  );
}

function VideoProviderCard({ health }: { health: VideoProviderReadiness }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <IntegrationIcon>
            <Video className="h-5 w-5 text-accent-foreground" />
          </IntegrationIcon>
          <div>
            <p className="text-sm font-medium">{health.label}</p>
            <p className="text-xs text-muted-foreground">
              Generated meeting links
            </p>
          </div>
        </div>
        <Badge variant={health.ready ? "default" : "secondary"}>
          {health.badgeLabel}
        </Badge>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {health.description}
      </p>
    </div>
  );
}

function StaticIntegrationCard({
  icon,
  label,
  description,
  badge,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <IntegrationIcon>{icon}</IntegrationIcon>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="secondary">{badge}</Badge>
      </div>
    </div>
  );
}

function IntegrationIcon({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-md bg-accent"
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function connectionBadgeText(
  connection: CalendarConnectionSummary | undefined,
  loadFailed = false
): string {
  if (!connection && loadFailed) {
    return "Unavailable";
  }

  if (!connection) {
    return "Not connected";
  }

  if (connection.status === "active") {
    return "Connected";
  }

  if (connection.status === "error") {
    return "Needs attention";
  }

  return "Disconnected";
}
