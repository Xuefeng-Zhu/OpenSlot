import { notFound } from "next/navigation";
import { createAdminBackendClient } from "@/lib/backend/server";
import type { Tables } from "@/lib/types/database";
import { SlotPicker } from "@/components/booking/slot-picker";
import { isBookingAgentConfigured } from "@/lib/backend/booking-agent-gateway";
import { normalizeInviteeQuestions } from "@/lib/validations/invitee-questions";
import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.bookTime;

interface BookingPageProps {
  params: Promise<{ username: string; eventSlug: string }>;
}

export default async function PublicBookingPage({ params }: BookingPageProps) {
  const { username, eventSlug } = await params;
  const backendClient = createAdminBackendClient();

  // Fetch profile by username
  const { data: profileData } = await backendClient
    .from("profiles")
    .select("id, name, username, avatar_url")
    .eq("username", username)
    .single();

  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "name" | "username" | "avatar_url"
  > | null;

  if (!profile) {
    notFound();
  }

  // Fetch active event type by slug for this host
  const { data: eventTypeData } = await backendClient
    .from("event_types")
    .select("id, title, slug, description, duration_minutes, location_type, location_value, video_provider, invitee_questions, user_id")
    .eq("user_id", profile.id)
    .eq("slug", eventSlug)
    .eq("is_active", true)
    .single();

  const eventType = eventTypeData as Pick<
    Tables<"event_types">,
    | "id"
    | "title"
    | "slug"
    | "description"
    | "duration_minutes"
    | "location_type"
    | "location_value"
    | "video_provider"
    | "user_id"
    | "invitee_questions"
  > | null;

  if (!eventType) {
    notFound();
  }

  return (
    <SlotPicker
      eventType={{
        ...eventType,
        invitee_questions: normalizeInviteeQuestions(eventType.invitee_questions),
      }}
      hostProfile={{
        id: profile.id,
        name: profile.name,
        username: profile.username!,
        avatar_url: profile.avatar_url,
      }}
      bookingAgentEnabled={isBookingAgentConfigured()}
    />
  );
}
