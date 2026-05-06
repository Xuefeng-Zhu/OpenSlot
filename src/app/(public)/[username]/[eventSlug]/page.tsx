import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SlotPicker } from "@/components/booking/slot-picker";
import type { Tables } from "@/lib/types/database";

interface EventBookingPageProps {
  params: Promise<{ username: string; eventSlug: string }>;
}

type Profile = Pick<Tables<"profiles">, "id" | "name" | "username" | "avatar_url">;
type EventType = Pick<
  Tables<"event_types">,
  | "id"
  | "user_id"
  | "title"
  | "slug"
  | "description"
  | "duration_minutes"
  | "location_type"
  | "is_active"
>;

export default async function EventBookingPage({ params }: EventBookingPageProps) {
  const { username, eventSlug } = await params;
  const supabase = await createServerSupabaseClient();

  // Fetch the profile by username
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url")
    .eq("username", username)
    .single();

  const profile = profileData as Profile | null;

  if (!profile) {
    notFound();
  }

  // Fetch the event type by slug and user_id
  const { data: eventTypeData } = await supabase
    .from("event_types")
    .select("id, user_id, title, slug, description, duration_minutes, location_type, is_active")
    .eq("user_id", profile.id)
    .eq("slug", eventSlug)
    .single();

  const eventType = eventTypeData as EventType | null;

  if (!eventType || !eventType.is_active) {
    notFound();
  }

  return (
    <SlotPicker
      eventType={{
        id: eventType.id,
        title: eventType.title,
        slug: eventType.slug,
        description: eventType.description,
        duration_minutes: eventType.duration_minutes,
        location_type: eventType.location_type,
        user_id: eventType.user_id,
      }}
      hostProfile={{
        id: profile.id,
        name: profile.name,
        username: profile.username!,
        avatar_url: profile.avatar_url,
      }}
    />
  );
}
