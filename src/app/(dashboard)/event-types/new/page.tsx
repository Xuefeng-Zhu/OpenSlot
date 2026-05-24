import { redirect } from "next/navigation";
import { EventTypeEditor, type ScheduleOption } from "../event-type-editor";
import { loadDashboardCalendarConnections } from "@/lib/dashboard/integration-load-state";
import { createAdminBackendClient, createServerBackendClient } from "@/lib/backend/server"
import type { Tables } from "@/lib/types/database";

export default async function NewEventTypePage() {
  const backendClient = await createServerBackendClient();

  const {
    data: { user },
  } = await backendClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await backendClient
    .from("profiles")
    .select("id, name, username, avatar_url")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "name" | "username" | "avatar_url"
  > | null;

  if (!profile?.username) {
    redirect("/onboarding");
  }

  const calendarConnections = await loadDashboardCalendarConnections(
    createAdminBackendClient(),
    profile.id
  );

  const { data: schedulesData } = await backendClient
    .from("schedules")
    .select("id, name, is_default")
    .eq("user_id", profile.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  const schedules = ((schedulesData as ScheduleOption[] | null) ?? []);

  return (
    <EventTypeEditor
      mode="create"
      hostProfile={{
        id: profile.id,
        name: profile.name,
        username: profile.username,
        avatar_url: profile.avatar_url,
      }}
      schedules={schedules}
      calendarConnections={calendarConnections.data}
      calendarConnectionsLoadFailed={calendarConnections.loadFailed}
    />
  );
}
