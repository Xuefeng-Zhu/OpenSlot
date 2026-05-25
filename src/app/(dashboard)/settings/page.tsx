import { redirect } from "next/navigation";
import {
  loadDashboardCalendarConnections,
  loadDashboardMcpTokens,
  loadDashboardWebhookEndpoints,
} from "@/lib/dashboard/integration-load-state";
import { createAdminBackendClient, createServerBackendClient } from "@/lib/backend/server"
import { SettingsClient } from "./settings-client";
import type { Tables } from "@/lib/types/database";
import type { SettingsFormValues } from "@/lib/validations/settings";

const defaultTimezone = "UTC";

export default async function SettingsPage() {
  const backendClient = await createServerBackendClient();
  const {
    data: { user },
  } = await backendClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await backendClient
    .from("profiles")
    .select("id, name, email, default_timezone")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  const typedProfile = profile as Pick<
    Tables<"profiles">,
    "id" | "name" | "email" | "default_timezone"
  >;

  const { data: settings } = await backendClient
    .from("user_settings")
    .select(
      "date_format, time_format, notify_new_booking, notify_cancellation, notify_reminder"
    )
    .eq("profile_id", typedProfile.id)
    .maybeSingle();

  const typedSettings = settings as Pick<
    Tables<"user_settings">,
    | "date_format"
    | "time_format"
    | "notify_new_booking"
    | "notify_cancellation"
    | "notify_reminder"
  > | null;

  const initialSettings: SettingsFormValues = {
    name: typedProfile.name || "",
    email: typedProfile.email || user.email || "",
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
      calendarConnections={calendarConnections.data}
      calendarConnectionsLoadFailed={calendarConnections.loadFailed}
      webhookEndpoints={webhookEndpoints.data}
      webhookEndpointsLoadFailed={webhookEndpoints.loadFailed}
      mcpTokens={mcpTokens.data}
      mcpTokensLoadFailed={mcpTokens.loadFailed}
    />
  );
}
