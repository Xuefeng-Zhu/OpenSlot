import { notFound, redirect } from "next/navigation";
import { createAdminBackendClient, createServerBackendClient } from "@/lib/backend/server"
import { ContactProfileClient } from "@/components/dashboard/contact-profile-client";
import {
  buildContactSummaries,
  buildContactTimeline,
  type ContactBookingRecord,
  type ContactEventRecord,
  type ContactRecord,
} from "@/lib/contacts/summaries";
import type { Tables } from "@/lib/types/database";

interface ContactPageProps {
  params: Promise<{ id: string }>;
}

interface BookingRow {
  id: string;
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

export default async function ContactPage({ params }: ContactPageProps) {
  const { id } = await params;
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

  const adminClient = createAdminBackendClient();
  const { data: contactData, error: contactError } = await adminClient
    .from("contacts")
    .select(
      "id, email_hash, display_name, last_guest_timezone, first_seen_at, last_seen_at, deleted_at"
    )
    .eq("id", id)
    .eq("host_user_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (contactError) {
    console.error("Error loading contact:", contactError);
    throw new Error("Failed to load contact");
  }

  if (!contactData) {
    notFound();
  }

  const contact = contactData as ContactRecord;
  const { data: bookingsData, error: bookingsError } = await adminClient
    .from("bookings")
    .select(
      "id, guest_name, guest_email, guest_timezone, notes, start_at, end_at, status, cancel_reason, rescheduled_from_booking_id, rescheduled_to_booking_id, rescheduled_at, created_at, updated_at, event_types(title)"
    )
    .eq("host_user_id", profile.id);

  if (bookingsError) {
    console.error("Error loading contact timeline bookings:", bookingsError);
    throw new Error("Failed to load contact timeline");
  }

  const bookings = ((bookingsData as BookingRow[]) ?? []).map(toContactBookingRecord);
  const timelineSeed = buildContactTimeline(contact, bookings);
  const bookingIds = timelineSeed.map((item) => item.bookingId);
  const events = await loadBookingEvents(adminClient, bookingIds);
  const timeline = buildContactTimeline(contact, bookings, events);
  const summary = buildContactSummaries([contact], bookings)[0];

  if (!summary) {
    notFound();
  }

  return <ContactProfileClient contact={summary} timeline={timeline} />;
}

async function loadBookingEvents(
  adminClient: ReturnType<typeof createAdminBackendClient>,
  bookingIds: string[]
): Promise<ContactEventRecord[]> {
  if (bookingIds.length === 0) return [];

  const { data, error } = await adminClient
    .from("booking_events")
    .select("booking_id, event_type, created_at")
    .in("booking_id", bookingIds);

  if (error) {
    console.error("Error loading contact booking events:", error);
    throw new Error("Failed to load contact timeline events");
  }

  return (data as ContactEventRecord[]) ?? [];
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
