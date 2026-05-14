import { redirect } from "next/navigation";
import { EventTypeEditor } from "../event-type-editor";
import { listCalendarConnectionSummaries } from "@/lib/calendar/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

export default async function NewEventTypePage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, name, username")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "name" | "username"
  > | null;

  if (!profile?.username) {
    redirect("/onboarding");
  }

  const calendarConnections = await listCalendarConnectionSummaries(
    createAdminClient(),
    profile.id
  ).catch((error) => {
    console.error("Error loading calendar connections:", error);
    return [];
  });

  return (
    <EventTypeEditor
      mode="create"
      hostName={profile.name}
      calendarConnections={calendarConnections}
    />
  );
}
