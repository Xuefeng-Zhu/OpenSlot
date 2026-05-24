import { redirect } from "next/navigation";
import { createServerBackendClient } from "@/lib/backend/server";
import { ContactsClient } from "@/components/dashboard/contacts-client";
import {
  buildContactSummaries,
  type ContactBookingRecord,
  type ContactRecord,
} from "@/lib/contacts/summaries";
import type { Tables } from "@/lib/types/database";

interface BookingRow {
  id: string;
  event_type_id: string;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  notes: string | null;
  start_at: string;
  end_at: string;
  status: string;
  cancel_reason: string | null;
  rescheduled_from_booking_id: string | null;
  rescheduled_to_booking_id: string | null;
  rescheduled_at: string | null;
  created_at: string;
  updated_at: string;
  event_types: { title: string } | null;
}

export default async function ContactsPage() {
  const backendClient = await createServerBackendClient();

  const {
    data: { user },
  } = await backendClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await backendClient
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<Tables<"profiles">, "id"> | null;

  if (!profile) {
    redirect("/onboarding");
  }

  const [
    { data: contactsData, error: contactsError },
    { data: bookingsData, error: bookingsError },
  ] = await Promise.all([
    backendClient
      .from("contacts")
      .select(
        "id, email_hash, display_name, last_guest_timezone, first_seen_at, last_seen_at, deleted_at"
      )
      .eq("host_user_id", profile.id)
      .is("deleted_at", null)
      .order("last_seen_at", { ascending: false }),
    backendClient
      .from("bookings")
      .select(
        "id, event_type_id, guest_name, guest_email, guest_timezone, notes, start_at, end_at, status, cancel_reason, rescheduled_from_booking_id, rescheduled_to_booking_id, rescheduled_at, created_at, updated_at, event_types(title)"
      )
      .eq("host_user_id", profile.id),
  ]);

  if (contactsError) {
    console.error("Error loading contacts:", contactsError);
    throw new Error("Failed to load contacts");
  }

  if (bookingsError) {
    console.error("Error loading contact booking history:", bookingsError);
    throw new Error("Failed to load contact booking history");
  }

  const contacts = buildContactSummaries(
    ((contactsData as ContactRecord[]) ?? []),
    ((bookingsData as BookingRow[]) ?? []).map(toContactBookingRecord)
  );

  return <ContactsClient contacts={contacts} />;
}

function toContactBookingRecord(booking: BookingRow): ContactBookingRecord {
  return {
    id: booking.id,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_timezone: booking.guest_timezone,
    notes: booking.notes ?? "",
    start_at: booking.start_at,
    end_at: booking.end_at,
    status: booking.status,
    cancel_reason: booking.cancel_reason,
    rescheduled_from_booking_id: booking.rescheduled_from_booking_id,
    rescheduled_to_booking_id: booking.rescheduled_to_booking_id,
    rescheduled_at: booking.rescheduled_at,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    event_type_title: booking.event_types?.title ?? "Unknown",
  };
}
