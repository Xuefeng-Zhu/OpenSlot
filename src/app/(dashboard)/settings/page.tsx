import { redirect } from "next/navigation";
import {
  loadDashboardCalendarConnections,
  loadDashboardWebhookEndpoints,
} from "@/lib/dashboard/integration-load-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";
import type { Tables } from "@/lib/types/database";
import type { SettingsFormValues } from "@/lib/validations/settings";

const defaultTimezone = "UTC";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
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

  const { data: settings } = await supabase
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

  const adminClient = createAdminClient();
  const [calendarConnections, webhookEndpoints] = await Promise.all([
    loadDashboardCalendarConnections(adminClient, typedProfile.id),
    loadDashboardWebhookEndpoints(adminClient, typedProfile.id),
  ]);

  return (
    <SettingsClient
      initialSettings={initialSettings}
      calendarConnections={calendarConnections.data}
      calendarConnectionsLoadFailed={calendarConnections.loadFailed}
      webhookEndpoints={webhookEndpoints.data}
      webhookEndpointsLoadFailed={webhookEndpoints.loadFailed}
    />
  );
}
