import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";
import BookingsClient from "@/components/dashboard/bookings-client";
import type { Booking } from "@/lib/booking-utils";

export default async function BookingsPage() {
  const supabase = await createServerSupabaseClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile using auth_user_id
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<Tables<"profiles">, "id"> | null;

  if (!profile) {
    redirect("/onboarding");
  }

  // Fetch all bookings joined with event_types for the authenticated user
  const { data: bookingsData } = await supabase
    .from("bookings")
    .select(
      "id, guest_name, guest_email, guest_timezone, notes, start_at, end_at, status, cancellation_token, event_types(title)"
    )
    .eq("host_user_id", profile.id);

  const bookings: Booking[] = (
    (bookingsData as Array<{
      id: string;
      guest_name: string;
      guest_email: string;
      guest_timezone: string;
      notes: string;
      start_at: string;
      end_at: string;
      status: string;
      cancellation_token: string;
      event_types: { title: string } | null;
    }>) ?? []
  ).map((booking) => ({
    id: booking.id,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_timezone: booking.guest_timezone,
    notes: booking.notes ?? "",
    start_at: booking.start_at,
    end_at: booking.end_at,
    status: booking.status,
    cancellation_token: booking.cancellation_token,
    event_type_title: booking.event_types?.title ?? "Unknown",
  }));

  return <BookingsClient bookings={bookings} />;
}
