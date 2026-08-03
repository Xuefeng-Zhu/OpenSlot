import { notFound, redirect } from "next/navigation";
import {
  type EditableEventType,
  EventTypeEditor,
  type ScheduleOption,
} from "../../event-type-editor";
import { loadDashboardCalendarConnections } from "@/lib/dashboard/integration-load-state";
import { createAdminBackendClient, createServerBackendClient } from "@/lib/backend/server"
import {
  optionalPageRow,
  pageCollection,
  pageUserOrNull,
} from "@/lib/backend/page-data";
import type { Tables } from "@/lib/types/database";
import type { EventTypeFormValues } from "@/lib/validations/event-type";
import { normalizeInviteeQuestions } from "@/lib/validations/invitee-questions";
import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.editEventType;

interface EditEventTypePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventTypePage({
  params,
}: EditEventTypePageProps) {
  const { id } = await params;
  const backendClient = await createServerBackendClient();

  const user = pageUserOrNull(await backendClient.auth.getUser());

  if (!user) {
    redirect("/login");
  }

  const profile = optionalPageRow(
    await backendClient
      .from("profiles")
      .select("id, name, username, avatar_url")
      .eq("auth_user_id", user.id)
      .single(),
    "dashboard profile"
  ) as Pick<
    Tables<"profiles">,
    "id" | "name" | "username" | "avatar_url"
  > | null;

  if (!profile?.username) {
    redirect("/onboarding");
  }

  const eventType = optionalPageRow(
    await backendClient
      .from("event_types")
      .select(
        "id, schedule_id, title, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_booking_days_ahead, location_type, location_value, video_provider, invitee_questions, is_active, reminder_enabled, reminder_minutes_before, reminder_guest_enabled, reminder_host_enabled"
      )
      .eq("id", id)
      .eq("user_id", profile.id)
      .single(),
    "event type"
  ) as
    | (Pick<
        Tables<"event_types">,
        | "id"
        | "schedule_id"
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
    notFound();
  }

  const editableEventType: EditableEventType = {
    id: eventType.id,
    schedule_id: eventType.schedule_id,
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

  const calendarConnections = await loadDashboardCalendarConnections(
    createAdminBackendClient(),
    profile.id
  );

  const schedules = pageCollection(
    await backendClient
      .from("schedules")
      .select("id, name, is_default")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    "availability schedules"
  ) as ScheduleOption[];

  return (
    <EventTypeEditor
      mode="edit"
      hostProfile={{
        id: profile.id,
        name: profile.name,
        username: profile.username,
        avatar_url: profile.avatar_url,
      }}
      schedules={schedules}
      initialEventType={editableEventType}
      calendarConnections={calendarConnections.data}
      calendarConnectionsLoadFailed={calendarConnections.loadFailed}
    />
  );
}
