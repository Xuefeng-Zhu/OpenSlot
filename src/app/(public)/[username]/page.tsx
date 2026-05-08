import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/types/database";
import { PublicProfileContent } from "./profile-content";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = createAdminClient();

  // Fetch profile by username
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url, default_timezone")
    .eq("username", username)
    .single();

  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "name" | "username" | "avatar_url" | "default_timezone"
  > | null;

  if (!profile) {
    notFound();
  }

  // Fetch active event types for this profile
  const { data: eventTypesData } = await supabase
    .from("event_types")
    .select("id, title, slug, description, duration_minutes, location_type")
    .eq("user_id", profile.id)
    .eq("is_active", true);

  const activeEventTypes = (eventTypesData ?? []) as Pick<
    Tables<"event_types">,
    "id" | "title" | "slug" | "description" | "duration_minutes" | "location_type"
  >[];

  return (
    <PublicProfileContent
      profile={{
        name: profile.name,
        username: profile.username!,
        avatar_url: profile.avatar_url,
        default_timezone: profile.default_timezone,
      }}
      activeEventTypes={activeEventTypes}
    />
  );
}
