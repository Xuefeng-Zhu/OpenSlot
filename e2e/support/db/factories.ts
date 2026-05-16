import type { InsertTables } from "../../../src/lib/types/database";
import { upsertContactForBooking } from "./contacts";
import { getDemoProfile } from "./demo-profile";
import { uniqueE2EId } from "./ids";
import type {
  CreatedBooking,
  CreatedEventType,
  E2EAdminClient,
  TimeSlot,
} from "./types";

export async function createEventType(
  adminClient: E2EAdminClient,
  overrides: Partial<InsertTables<"event_types">> = {}
): Promise<CreatedEventType> {
  const profile = await getDemoProfile(adminClient);
  const suffix = uniqueE2EId("e2e");
  const title =
    overrides.title ?? `E2E ${suffix.replace(/-/g, " ").toUpperCase()}`;
  const slug = overrides.slug ?? suffix;
  const durationMinutes = overrides.duration_minutes ?? 30;

  const { data, error } = await adminClient
    .from("event_types")
    .insert({
      user_id: profile.id,
      title,
      slug,
      description: "Created by the automated E2E suite.",
      duration_minutes: durationMinutes,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_minutes: 0,
      max_booking_days_ahead: 60,
      location_type: "online",
      location_value: "https://meet.example.com/e2e",
      is_active: true,
      ...overrides,
    })
    .select("id, title, slug, duration_minutes")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create E2E event type: ${error?.message ?? "missing row"}`
    );
  }

  return {
    id: data.id,
    profile,
    title: data.title,
    slug: data.slug,
    durationMinutes: data.duration_minutes,
  };
}

export async function createConfirmedBooking(
  adminClient: E2EAdminClient,
  {
    eventType,
    guestName,
    guestEmail,
    startAt,
    endAt,
    notes = "Created by the automated E2E suite.",
  }: {
    eventType: CreatedEventType;
    guestName: string;
    guestEmail: string;
    startAt: string;
    endAt: string;
    notes?: string;
  }
): Promise<CreatedBooking> {
  const { data, error } = await adminClient
    .from("bookings")
    .insert({
      event_type_id: eventType.id,
      host_user_id: eventType.profile.id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_timezone: "America/New_York",
      notes,
      start_at: startAt,
      end_at: endAt,
      status: "confirmed",
    })
    .select("id, cancellation_token, reschedule_token")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create E2E booking: ${error?.message ?? "missing row"}`
    );
  }

  await upsertContactForBooking(adminClient, {
    bookingId: data.id,
    hostUserId: eventType.profile.id,
    guestName,
    guestEmail,
  });

  return {
    id: data.id,
    cancellationToken: data.cancellation_token,
    rescheduleToken: data.reschedule_token,
    guestEmail,
    guestName,
    startAt,
    endAt,
  };
}

export async function createSlotHold(
  adminClient: E2EAdminClient,
  {
    eventType,
    slot,
    guestEmail,
  }: {
    eventType: CreatedEventType;
    slot: TimeSlot;
    guestEmail: string;
  }
) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await adminClient.rpc("create_slot_hold_with_reservation", {
    p_event_type_id: eventType.id,
    p_host_user_id: eventType.profile.id,
    p_start_at: slot.start,
    p_end_at: slot.end,
    p_guest_email: guestEmail,
    p_expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Could not create E2E slot hold: ${error.message}`);
  }
}
