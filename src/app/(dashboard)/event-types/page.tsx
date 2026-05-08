import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";
import {
  EventTypesClient,
  type DashboardEventType,
} from "./event-types-client";

const locationLabels: Record<string, string> = {
  online: "Online meeting",
  phone: "Phone call",
  in_person: "In person",
  custom: "Custom location",
};

function buildBookingUrl(username: string, slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${appUrl}/${username}/${slug}`;
}

export default async function EventTypesPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "username"
  > | null;

  if (!profile?.username) {
    redirect("/onboarding");
  }

  const username = profile.username;

  const { data: eventTypesData } = await supabase
    .from("event_types")
    .select(
      "id, title, slug, description, duration_minutes, location_type, is_active, created_at"
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const eventTypes = ((eventTypesData as Array<Pick<
    Tables<"event_types">,
    | "id"
    | "title"
    | "slug"
    | "description"
    | "duration_minutes"
    | "location_type"
    | "is_active"
  >>) ?? []).map<DashboardEventType>((eventType) => ({
    id: eventType.id,
    title: eventType.title,
    description: eventType.description,
    durationMinutes: eventType.duration_minutes,
    locationType:
      locationLabels[eventType.location_type] ?? eventType.location_type,
    slug: eventType.slug,
    isActive: eventType.is_active,
    bookingUrl: buildBookingUrl(username, eventType.slug),
  }));

  return <EventTypesClient initialEventTypes={eventTypes} />;
}
