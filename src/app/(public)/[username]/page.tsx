import { notFound } from "next/navigation";
import { createAdminBackendClient } from "@/lib/backend/server";
import type { Tables } from "@/lib/types/database";
import { PublicProfileContent } from "./profile-content";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const backendClient = createAdminBackendClient();

  const profile = await fetchPublicProfile(backendClient, username);

  if (!profile) {
    notFound();
  }

  // Fetch active event types for this profile
  const { data: eventTypesData } = await backendClient
    .from("event_types")
    .select("id, title, slug, description, duration_minutes, location_type, video_provider")
    .eq("user_id", profile.id)
    .eq("is_active", true);

  const activeEventTypes = (eventTypesData ?? []) as Pick<
    Tables<"event_types">,
    | "id"
    | "title"
    | "slug"
    | "description"
    | "duration_minutes"
    | "location_type"
    | "video_provider"
  >[];

  return (
    <PublicProfileContent
      profile={{
        name: profile.name,
        username: profile.username!,
        avatar_url: profile.avatar_url,
        default_timezone: profile.default_timezone,
        public_headline: profile.public_headline,
        public_bio: profile.public_bio,
        response_time_label: profile.response_time_label,
      }}
      activeEventTypes={activeEventTypes}
    />
  );
}

type PublicProfile = Pick<
  Tables<"profiles">,
  | "id"
  | "name"
  | "username"
  | "avatar_url"
  | "default_timezone"
  | "public_headline"
  | "public_bio"
  | "response_time_label"
>;

type PublicProfileClient = ReturnType<typeof createAdminBackendClient>;

async function fetchPublicProfile(
  backendClient: PublicProfileClient,
  username: string
): Promise<PublicProfile | null> {
  const { data, error } = await backendClient
    .from("profiles")
    .select(
      "id, name, username, avatar_url, default_timezone, public_headline, public_bio, response_time_label"
    )
    .eq("username", username)
    .single();

  if (!error) {
    return data as PublicProfile | null;
  }

  if (!isMissingPublicProfileMetadataError(error)) {
    return null;
  }

  const { data: fallbackData } = await backendClient
    .from("profiles")
    .select("id, name, username, avatar_url, default_timezone")
    .eq("username", username)
    .single();

  if (!fallbackData) {
    return null;
  }

  const fallbackProfile = fallbackData as Pick<
    Tables<"profiles">,
    "id" | "name" | "username" | "avatar_url" | "default_timezone"
  >;

  return {
    ...fallbackProfile,
    public_headline: null,
    public_bio: null,
    response_time_label: null,
  };
}

function isMissingPublicProfileMetadataError(error: { message?: string }) {
  const message = error.message ?? "";
  return (
    message.includes("public_headline") ||
    message.includes("public_bio") ||
    message.includes("response_time_label")
  );
}
