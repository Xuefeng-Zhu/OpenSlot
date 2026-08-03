import { redirect } from "next/navigation";
import { createServerBackendClient } from "@/lib/backend/server";
import {
  optionalPageRow,
  pageCollection,
  pageUserOrNull,
} from "@/lib/backend/page-data";
import type { Tables } from "@/lib/types/database";
import BookingsClient from "@/components/dashboard/bookings-client";
import type { Booking } from "@/lib/booking-utils";
import { normalizeBookingAnswerSummaries } from "@/lib/validations/invitee-questions";
import { routeMetadata } from "@/app/route-metadata";

export const metadata = routeMetadata.bookings;

export default async function BookingsPage() {
  const backendClient = await createServerBackendClient();

  const user = pageUserOrNull(await backendClient.auth.getUser());

  if (!user) {
    redirect("/login");
  }

  const profile = optionalPageRow(
    await backendClient
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single(),
    "dashboard profile"
  ) as Pick<Tables<"profiles">, "id"> | null;

  if (!profile) {
    redirect("/onboarding");
  }

  const bookingsData = pageCollection(
    await backendClient
      .from("bookings")
      .select(
        "id, event_type_id, guest_name, guest_email, guest_timezone, notes, booking_answers, start_at, end_at, status, cancellation_token, location_type, location_value, conference_provider, conference_url, conference_status, conference_error, event_types(title)"
      )
      .eq("host_user_id", profile.id)
      .order("start_at", { ascending: true }),
    "bookings"
  ) as Array<{
    id: string;
    event_type_id: string;
    guest_name: string;
    guest_email: string;
    guest_timezone: string;
    notes: string;
    booking_answers: unknown;
    start_at: string;
    end_at: string;
    status: string;
    cancellation_token: string;
    location_type: string;
    location_value: string;
    conference_provider: string | null;
    conference_url: string | null;
    conference_status: string;
    conference_error: string | null;
    event_types: { title: string } | null;
  }>;

  const bookings: Booking[] = bookingsData.map((booking) => ({
    id: booking.id,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_timezone: booking.guest_timezone,
    notes: booking.notes ?? "",
    booking_answers: normalizeBookingAnswerSummaries(booking.booking_answers),
    start_at: booking.start_at,
    end_at: booking.end_at,
    status: booking.status,
    cancellation_token: booking.cancellation_token,
    location_type: booking.location_type,
    location_value: booking.location_value,
    conference_provider: booking.conference_provider,
    conference_url: booking.conference_url,
    conference_status: booking.conference_status,
    conference_error: booking.conference_error,
    event_type_title: booking.event_types?.title ?? "Unknown",
  }));

  return <BookingsClient bookings={bookings} />;
}
