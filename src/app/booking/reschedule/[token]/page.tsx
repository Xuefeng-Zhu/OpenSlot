import { Calendar, Clock, User } from "lucide-react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SlotPicker } from "@/components/booking/slot-picker";
import type { Tables } from "@/lib/types/database";

interface ReschedulePageProps {
  params: Promise<{ token: string }>;
}

export default async function RescheduleBookingPage({
  params,
}: ReschedulePageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: bookingData } = await supabase
    .from("bookings")
    .select("*")
    .eq("reschedule_token", token)
    .eq("status", "confirmed")
    .single();

  const booking = bookingData as Tables<"bookings"> | null;

  if (!booking) {
    notFound();
  }

  const [{ data: eventTypeData }, { data: profileData }] = await Promise.all([
    supabase
      .from("event_types")
      .select(
        "id, title, slug, description, duration_minutes, location_type, location_value, video_provider, user_id"
      )
      .eq("id", booking.event_type_id)
      .eq("is_active", true)
      .single(),
    supabase
      .from("profiles")
      .select("id, name, username, avatar_url")
      .eq("id", booking.host_user_id)
      .single(),
  ]);

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
  > | null;
  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "name" | "username" | "avatar_url"
  > | null;

  if (!eventType || !profile || !profile.username) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Reschedule booking</h1>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>{booking.guest_name}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/30 p-3">
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>{eventType.title}</span>
          </div>
          <div className="rounded-md bg-muted/30 p-3 text-muted-foreground">
            Choose a new available time below.
          </div>
        </div>
      </div>

      <SlotPicker
        eventType={eventType}
        hostProfile={{
          id: profile.id,
          name: profile.name,
          username: profile.username,
          avatar_url: profile.avatar_url,
        }}
        rescheduleContext={{
          token,
          guestName: booking.guest_name,
          guestEmail: booking.guest_email,
          guestTimezone: booking.guest_timezone,
          currentStartAt: booking.start_at,
          currentEndAt: booking.end_at,
        }}
      />
    </div>
  );
}
