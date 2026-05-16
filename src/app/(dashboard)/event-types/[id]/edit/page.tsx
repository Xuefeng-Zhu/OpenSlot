import Link from "next/link";
import { redirect } from "next/navigation";
import {
  type EditableEventType,
  EventTypeEditor,
} from "../../event-type-editor";
import { Button } from "@/components/ui/button";
import { listCalendarConnectionSummaries } from "@/lib/calendar/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";
import type { EventTypeFormValues } from "@/lib/validations/event-type";
import { normalizeInviteeQuestions } from "@/lib/validations/invitee-questions";

interface EditEventTypePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventTypePage({
  params,
}: EditEventTypePageProps) {
  const { id } = await params;
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

  const { data: eventTypeData } = await supabase
    .from("event_types")
    .select(
      "id, title, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, location_type, location_value, video_provider, invitee_questions, is_active, reminder_enabled, reminder_minutes_before, reminder_guest_enabled, reminder_host_enabled"
    )
    .eq("id", id)
    .eq("user_id", profile.id)
    .single();

  const eventType = eventTypeData as
    | (Pick<
        Tables<"event_types">,
        | "id"
        | "title"
        | "slug"
        | "description"
        | "duration_minutes"
        | "buffer_before_minutes"
        | "buffer_after_minutes"
        | "min_notice_minutes"
        | "max_booking_days_ahead"
        | "location_type"
        | "location_value"
        | "video_provider"
        | "invitee_questions"
        | "is_active"
        | "reminder_enabled"
        | "reminder_minutes_before"
        | "reminder_guest_enabled"
        | "reminder_host_enabled"
      > & {
        location_type: EventTypeFormValues["location_type"];
        video_provider: EventTypeFormValues["video_provider"];
      })
    | null;

  if (!eventType) {
    return <EventTypeNotFound />;
  }

  const editableEventType: EditableEventType = {
    id: eventType.id,
    title: eventType.title,
    slug: eventType.slug,
    description: eventType.description,
    duration_minutes: eventType.duration_minutes,
    buffer_before_minutes: eventType.buffer_before_minutes,
    buffer_after_minutes: eventType.buffer_after_minutes,
    min_notice_minutes: eventType.min_notice_minutes,
    max_booking_days_ahead: eventType.max_booking_days_ahead,
    location_type: eventType.location_type,
    location_value: eventType.location_value,
    video_provider: eventType.video_provider,
    invitee_questions: normalizeInviteeQuestions(eventType.invitee_questions),
    is_active: eventType.is_active,
    reminder_enabled: eventType.reminder_enabled,
    reminder_minutes_before: eventType.reminder_minutes_before,
    reminder_guest_enabled: eventType.reminder_guest_enabled,
    reminder_host_enabled: eventType.reminder_host_enabled,
  };

  const calendarConnections = await listCalendarConnectionSummaries(
    createAdminClient(),
    profile.id
  ).catch((error) => {
    console.error("Error loading calendar connections:", error);
    return [];
  });

  return (
    <EventTypeEditor
      mode="edit"
      hostName={profile.name}
      initialEventType={editableEventType}
      calendarConnections={calendarConnections}
    />
  );
}

function EventTypeNotFound() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Event type not found
        </h1>
        <p className="text-muted-foreground">
          We couldn&apos;t find that event type. It may have been deleted.
        </p>
      </div>
      <Button asChild>
        <Link href="/event-types">Back to event types</Link>
      </Button>
    </div>
  );
}
