import { redirect } from "next/navigation";
import { EventTypeEditor } from "../event-type-editor";
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
    .select("name, username")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<
    Tables<"profiles">,
    "name" | "username"
  > | null;

  if (!profile?.username) {
    redirect("/onboarding");
  }

  return <EventTypeEditor mode="create" hostName={profile.name} />;
}
