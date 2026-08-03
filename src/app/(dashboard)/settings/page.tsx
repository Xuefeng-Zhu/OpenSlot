import { redirect } from "next/navigation";
import {
  loadDashboardCalendarConnections,
  loadDashboardMcpTokens,
  loadDashboardWebhookEndpoints,
} from "@/lib/dashboard/integration-load-state";
import { createAdminBackendClient, createServerBackendClient } from "@/lib/backend/server"
import { optionalPageRow, pageUserOrNull } from "@/lib/backend/page-data";
import { SettingsClient } from "./settings-client";
import type { Tables } from "@/lib/types/database";
import {
  settingsTabs,
  type SettingsFormValues,
  type SettingsTab,
} from "@/lib/validations/settings";
import { routeMetadata } from "@/app/route-metadata";
import {
  parseCalendarOAuthResult,
  type CalendarOAuthResult,
} from "@/lib/calendar/oauth-result";

const defaultTimezone = "UTC";
interface SettingsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = routeMetadata.settings;

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const oauthResult = parseOAuthResult(resolvedSearchParams);
  const clearIgnoredCalendarOAuthResult =
    firstSearchParam(resolvedSearchParams.calendar) === "error" &&
    oauthResult === null;
  const requestedTab = firstSearchParam(resolvedSearchParams.tab);
  const initialTab = settingsTabs.includes(requestedTab as SettingsTab)
    ? (requestedTab as SettingsTab)
    : oauthResult || clearIgnoredCalendarOAuthResult
      ? "integrations"
      : "account";
  const backendClient = await createServerBackendClient();
  const user = pageUserOrNull(await backendClient.auth.getUser());

  if (!user) {
    redirect("/login");
  }

  const profile = optionalPageRow(
    await backendClient
      .from("profiles")
      .select("id, email, default_timezone")
      .eq("auth_user_id", user.id)
      .single(),
    "dashboard profile"
  );

  if (!profile) {
    redirect("/onboarding");
  }

  const typedProfile = profile as Pick<
    Tables<"profiles">,
    "id" | "email" | "default_timezone"
  >;

  const typedSettings = optionalPageRow(
    await backendClient
      .from("user_settings")
      .select(
        "date_format, time_format, notify_new_booking, notify_cancellation, notify_reminder"
      )
      .eq("profile_id", typedProfile.id)
      .maybeSingle(),
    "settings"
  ) as Pick<
      Tables<"user_settings">,
      | "date_format"
      | "time_format"
      | "notify_new_booking"
      | "notify_cancellation"
      | "notify_reminder"
    > | null;

  const initialSettings: SettingsFormValues = {
    email: user.email || typedProfile.email || "",
    defaultTimezone: typedProfile.default_timezone || defaultTimezone,
    dateFormat: (typedSettings?.date_format ?? "MM/DD/YYYY") as SettingsFormValues["dateFormat"],
    timeFormat: (typedSettings?.time_format ?? "12h") as SettingsFormValues["timeFormat"],
    notifyNewBooking: typedSettings?.notify_new_booking ?? true,
    notifyCancellation: typedSettings?.notify_cancellation ?? true,
    notifyReminder: typedSettings?.notify_reminder ?? true,
  };

  const adminClient = createAdminBackendClient();
  const [calendarConnections, webhookEndpoints, mcpTokens] = await Promise.all([
    loadDashboardCalendarConnections(adminClient, typedProfile.id),
    loadDashboardWebhookEndpoints(adminClient, typedProfile.id),
    loadDashboardMcpTokens(adminClient, typedProfile.id),
  ]);

  return (
    <SettingsClient
      initialSettings={initialSettings}
      initialTab={initialTab}
      calendarOAuthResult={oauthResult}
      clearIgnoredCalendarOAuthResult={clearIgnoredCalendarOAuthResult}
      calendarConnections={calendarConnections.data}
      calendarConnectionsLoadFailed={calendarConnections.loadFailed}
      webhookEndpoints={webhookEndpoints.data}
      webhookEndpointsLoadFailed={webhookEndpoints.loadFailed}
      mcpTokens={mcpTokens.data}
      mcpTokensLoadFailed={mcpTokens.loadFailed}
    />
  );
}

function parseOAuthResult(
  searchParams: Record<string, string | string[] | undefined>
): CalendarOAuthResult | null {
  return parseCalendarOAuthResult({
    get(name) {
      return firstSearchParam(searchParams[name]);
    },
  });
}

function firstSearchParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
