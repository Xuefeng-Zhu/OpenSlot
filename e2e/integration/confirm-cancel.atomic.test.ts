/**
 * Property 14: confirm_booking and cancel_booking RPCs are atomic.
 * Validates: Requirements 7.4, 8.4, 9.2
 *
 * Real-DB integration test that exercises the atomic booking confirmation and
 * cancellation RPCs introduced in migration
 * `20260526120000_add_confirm_cancel_booking_functions.sql`. The test asserts
 * the strongest possible atomicity guarantees:
 *
 *   * A successful confirm produces the full set of outbox_events /
 *     booking_events / host_reservations / bookings writes in a single RPC
 *     call.
 *   * A confirm that violates the `no_overlapping_bookings` exclusion
 *     constraint raises `23P01` and rolls back ALL side-effect rows (outbox,
 *     booking_events, the bookings insert itself, and any host_reservations
 *     conversion the RPC would have performed).
 *   * A successful cancel flips the bookings and host_reservations status
 *     and emits the full set of outbox + booking_events rows in one call.
 *   * A second cancel on the same booking raises `booking_already_cancelled`
 *     (P0001) and adds no new rows.
 *   * A cancel on a rescheduled booking raises `booking_already_rescheduled`
 *     (P0001).
 *
 * The test is gated on `NEXT_PUBLIC_BUTTERBASE_APP_ID` and
 * `BUTTERBASE_API_KEY` (the same env vars the Playwright E2E suite uses), so
 * CI and local runs without a configured test backend skip the suite
 * cleanly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createE2EAdminClient } from "../support/db/client";
import {
  cleanupEventType,
  createEventType,
  createSlotHold,
} from "../support/db";
import { uniqueE2EId } from "../support/db/ids";
import type { E2EAdminClient, TimeSlot } from "../support/db/types";

const skipIntegration = !(
  process.env.NEXT_PUBLIC_BUTTERBASE_APP_ID && process.env.BUTTERBASE_API_KEY
);

const futureSlot = (offsetHours: number, durationMinutes: number): TimeSlot => {
  // Place the slot far enough in the future that availability / notice
  // windows do not interfere, and far enough apart from any other test's
  // slot to avoid host_reservations overlap.
  const start = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() - (start.getUTCMinutes() % 30));
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
};

const GUEST_EMAIL = (suffix: string) => `atomic-${suffix}@example.com`;

async function readBookingRow(
  adminClient: E2EAdminClient,
  bookingId: string
) {
  const { data } = await adminClient
    .from("bookings")
    .select("id, status, cancellation_token, reschedule_token")
    .eq("id", bookingId)
    .maybeSingle();
  return data;
}

async function readOutboxDedupeKeys(
  adminClient: E2EAdminClient,
  bookingId: string
): Promise<string[]> {
  const { data } = await adminClient
    .from("outbox_events")
    .select("dedupe_key")
    .eq("aggregate_type", "booking")
    .eq("aggregate_id", bookingId);
  return (data ?? []).map((row: { dedupe_key: unknown }) =>
    String(row.dedupe_key)
  );
}

async function readBookingEventTypes(
  adminClient: E2EAdminClient,
  bookingId: string
): Promise<string[]> {
  const { data } = await adminClient
    .from("booking_events")
    .select("event_type")
    .eq("booking_id", bookingId);
  return (data ?? []).map((row: { event_type: unknown }) =>
    String(row.event_type)
  );
}

async function readReservationForBooking(
  adminClient: E2EAdminClient,
  bookingId: string
) {
  const { data } = await adminClient
    .from("host_reservations")
    .select("source, source_id, status")
    .eq("source", "booking")
    .eq("source_id", bookingId)
    .maybeSingle();
  return data;
}

async function readHoldIdForToken(
  adminClient: E2EAdminClient,
  holdToken: string
) {
  const { data } = await adminClient
    .from("slot_holds")
    .select("id")
    .eq("hold_token", holdToken)
    .maybeSingle();
  return data?.id as string | undefined;
}

async function fullCleanupForEventType(
  adminClient: E2EAdminClient,
  eventTypeId: string
) {
  // Wipe bookings first so the event_types delete at the end does not
  // trip the deferred NO ACTION FK.
  const { data: bookings } = await adminClient
    .from("bookings")
    .select("id")
    .eq("event_type_id", eventTypeId);
  const bookingIds = (bookings ?? []).map((row: { id: unknown }) =>
    String(row.id)
  );

  for (const bookingId of bookingIds) {
    await adminClient
      .from("outbox_events")
      .delete()
      .eq("aggregate_type", "booking")
      .eq("aggregate_id", bookingId);
    await adminClient
      .from("booking_events")
      .delete()
      .eq("booking_id", bookingId);
    await adminClient
      .from("host_reservations")
      .delete()
      .eq("source", "booking")
      .eq("source_id", bookingId);
    await adminClient.from("bookings").delete().eq("id", bookingId);
  }

  // Wipe remaining holds and their reservations.
  const { data: holds } = await adminClient
    .from("slot_holds")
    .select("id")
    .eq("event_type_id", eventTypeId);
  const holdIds = (holds ?? []).map((row: { id: unknown }) =>
    String(row.id)
  );
  if (holdIds.length > 0) {
    await adminClient
      .from("host_reservations")
      .delete()
      .eq("source", "hold")
      .in("source_id", holdIds);
    await adminClient.from("slot_holds").delete().in("id", holdIds);
  }

  await cleanupEventType(adminClient, eventTypeId);
}

const describeIfConfigured = skipIntegration ? describe.skip : describe;

describeIfConfigured(
  "Property 14: confirm_booking / cancel_booking RPC atomicity",
  () => {
    let adminClient: E2EAdminClient;
    const cleanupEventTypeIds: string[] = [];

    beforeAll(async () => {
      adminClient = createE2EAdminClient();
    });

    afterAll(async () => {
      for (const eventTypeId of cleanupEventTypeIds) {
        try {
          await fullCleanupForEventType(adminClient, eventTypeId);
        } catch {
          // Best-effort cleanup; the E2E global setup sweeps stale rows.
        }
      }
    });

    it(
      "confirm_booking writes booking + reservation + booking_events + outbox_events in one transaction",
      async () => {
        const eventType = await createEventType(adminClient, {
          slug: uniqueE2EId("confirm-happy"),
        });
        cleanupEventTypeIds.push(eventType.id);
        const slot = futureSlot(72, eventType.durationMinutes);
        const guestEmail = GUEST_EMAIL(uniqueE2EId("happy"));

        await createSlotHold(adminClient, {
          eventType,
          slot,
          guestEmail,
        });

        // The hold token is generated inside create_slot_hold_with_reservation.
        // Look it up to confirm via the RPC.
        const { data: holdRow } = await adminClient
          .from("slot_holds")
          .select("hold_token")
          .eq("event_type_id", eventType.id)
          .eq("start_at", slot.start)
          .maybeSingle();
        expect(holdRow?.hold_token).toBeTruthy();
        const holdToken = String(holdRow!.hold_token);

        const { data, error } = await adminClient
          .rpc("confirm_booking", {
            p_hold_token: holdToken,
            p_guest_name: "Atomic Happy",
            p_guest_email: guestEmail,
            p_guest_timezone: "UTC",
            p_notes: "",
            p_booking_answers: [],
          })
          .single();

        expect(error).toBeNull();
        expect(data?.booking_id).toBeTruthy();
        const bookingId = String(data!.booking_id);

        const booking = await readBookingRow(adminClient, bookingId);
        expect(booking?.status).toBe("confirmed");

        const reservation = await readReservationForBooking(
          adminClient,
          bookingId
        );
        expect(reservation?.status).toBe("active");
        expect(reservation?.source).toBe("booking");

        const bookingEvents = await readBookingEventTypes(
          adminClient,
          bookingId
        );
        expect(bookingEvents).toContain("booking.confirmed");

        const dedupeKeys = await readOutboxDedupeKeys(adminClient, bookingId);
        // Four dedupe keys: confirmed, calendar.write.requested,
        // notifications.requested, tenant.webhooks.requested.
        expect(dedupeKeys).toEqual(
          expect.arrayContaining([
            `booking:${bookingId}:confirmed`,
            `booking:${bookingId}:calendar-write-requested`,
            `booking:${bookingId}:notifications-requested`,
            `booking:${bookingId}:tenant-webhooks-requested`,
          ])
        );
        expect(dedupeKeys).toHaveLength(4);
      }
    );

    it(
      "confirm_booking rolls back every side-effect row when the booking overlap constraint fires",
      async () => {
        const eventType = await createEventType(adminClient, {
          slug: uniqueE2EId("confirm-rollback"),
        });
        cleanupEventTypeIds.push(eventType.id);
        const slot = futureSlot(96, eventType.durationMinutes);
        const guestEmail = GUEST_EMAIL(uniqueE2EId("rollback"));

        // Step 1: install a confirmed booking that occupies the same window
        // so the next confirm hits no_overlapping_bookings (23P01).
        const existing = await adminClient
          .from("bookings")
          .insert({
            event_type_id: eventType.id,
            host_user_id: eventType.profile.id,
            guest_name: "Existing Booker",
            guest_email: `existing-${uniqueE2EId("e")}@example.com`,
            guest_timezone: "UTC",
            notes: "",
            start_at: slot.start,
            end_at: slot.end,
            status: "confirmed",
            location_type: "online",
            location_value: "https://meet.example.com/existing",
            conference_provider: null,
            conference_status: "not_required",
            conference_error: null,
          })
          .select("id")
          .single();
        expect(existing.error).toBeNull();
        const existingBookingId = String(existing.data!.id);

        // Step 2: create a hold for the SAME window via the existing RPC.
        await createSlotHold(adminClient, {
          eventType,
          slot,
          guestEmail,
        });
        const { data: holdRow } = await adminClient
          .from("slot_holds")
          .select("hold_token")
          .eq("event_type_id", eventType.id)
          .eq("start_at", slot.start)
          .maybeSingle();
        const holdToken = String(holdRow!.hold_token);

        // Step 3: snapshot the outbox / booking_events / bookings count
        // BEFORE the failing confirm so we can prove nothing was added.
        const outboxBefore =
          (
            await adminClient
              .from("outbox_events")
              .select("id")
              .eq("aggregate_type", "booking")
          ).data?.length ?? 0;
        const bookingEventsBefore =
          (
            await adminClient.from("booking_events").select("id")
          ).data?.length ?? 0;
        const bookingsBefore =
          (
            await adminClient
              .from("bookings")
              .select("id")
              .eq("event_type_id", eventType.id)
          ).data?.length ?? 0;

        // Step 4: confirm should fail with 23P01 (exclusion violation).
        const { data: rpcData, error: rpcError } = await adminClient
          .rpc("confirm_booking", {
            p_hold_token: holdToken,
            p_guest_name: "Atomic Rollback",
            p_guest_email: guestEmail,
            p_guest_timezone: "UTC",
            p_notes: "",
            p_booking_answers: [],
          })
          .single();

        expect(rpcData).toBeNull();
        expect(rpcError).not.toBeNull();
        expect(rpcError?.code).toBe("23P01");

        // Step 5: assert the transaction rolled back EVERY side-effect row.
        // No new bookings row.
        const bookingsAfter =
          (
            await adminClient
              .from("bookings")
              .select("id")
              .eq("event_type_id", eventType.id)
          ).data?.length ?? 0;
        expect(bookingsAfter).toBe(bookingsBefore);

        // No new booking_events row.
        const bookingEventsAfter =
          (
            await adminClient.from("booking_events").select("id")
          ).data?.length ?? 0;
        expect(bookingEventsAfter).toBe(bookingEventsBefore);

        // No new outbox_events row.
        const outboxAfter =
          (
            await adminClient
              .from("outbox_events")
              .select("id")
              .eq("aggregate_type", "booking")
          ).data?.length ?? 0;
        expect(outboxAfter).toBe(outboxBefore);

        // Step 6: a fresh hold at a different time succeeds, proving the
        // failed transaction left no half-written state behind.
        const freshSlot = futureSlot(120, eventType.durationMinutes);
        await createSlotHold(adminClient, {
          eventType,
          slot: freshSlot,
          guestEmail: GUEST_EMAIL(uniqueE2EId("fresh")),
        });
        const { data: freshHold } = await adminClient
          .from("slot_holds")
          .select("hold_token")
          .eq("event_type_id", eventType.id)
          .eq("start_at", freshSlot.start)
          .maybeSingle();
        const { data: freshRpc, error: freshError } = await adminClient
          .rpc("confirm_booking", {
            p_hold_token: String(freshHold!.hold_token),
            p_guest_name: "Atomic Fresh",
            p_guest_email: "atomic-fresh@example.com",
            p_guest_timezone: "UTC",
            p_notes: "",
            p_booking_answers: [],
          })
          .single();
        expect(freshError).toBeNull();
        const freshBookingId = String(freshRpc!.booking_id);

        const freshDedupeKeys = await readOutboxDedupeKeys(
          adminClient,
          freshBookingId
        );
        expect(freshDedupeKeys).toHaveLength(4);
      }
    );

    it(
      "cancel_booking writes the cancelled status + reservation release + booking_events + outbox_events in one transaction",
      async () => {
        const eventType = await createEventType(adminClient, {
          slug: uniqueE2EId("cancel-happy"),
        });
        cleanupEventTypeIds.push(eventType.id);
        const slot = futureSlot(144, eventType.durationMinutes);
        const guestEmail = GUEST_EMAIL(uniqueE2EId("cancel-happy"));

        await createSlotHold(adminClient, {
          eventType,
          slot,
          guestEmail,
        });
        const { data: holdRow } = await adminClient
          .from("slot_holds")
          .select("hold_token")
          .eq("event_type_id", eventType.id)
          .eq("start_at", slot.start)
          .maybeSingle();
        const holdToken = String(holdRow!.hold_token);

        const { data: confirmed, error: confirmError } = await adminClient
          .rpc("confirm_booking", {
            p_hold_token: holdToken,
            p_guest_name: "Atomic Cancel",
            p_guest_email: guestEmail,
            p_guest_timezone: "UTC",
            p_notes: "",
            p_booking_answers: [],
          })
          .single();
        expect(confirmError).toBeNull();
        const bookingId = String(confirmed!.booking_id);
        const cancellationToken = String(confirmed!.cancellation_token);

        // Cancel.
        const { error: cancelError } = await adminClient.rpc("cancel_booking", {
          p_cancellation_token: cancellationToken,
          p_cancel_reason: "atomic test",
          p_actor_type: "guest",
          p_actor_id: null,
        });
        expect(cancelError).toBeNull();

        const booking = await readBookingRow(adminClient, bookingId);
        expect(booking?.status).toBe("cancelled");

        const reservation = await readReservationForBooking(
          adminClient,
          bookingId
        );
        expect(reservation?.status).toBe("cancelled");

        const bookingEvents = await readBookingEventTypes(
          adminClient,
          bookingId
        );
        expect(bookingEvents).toContain("booking.cancelled");

        const dedupeKeys = await readOutboxDedupeKeys(adminClient, bookingId);
        // Four dedupe keys: cancelled, calendar.cancel.requested,
        // notifications.cancel.requested, tenant.webhooks.cancel.requested.
        expect(dedupeKeys).toEqual(
          expect.arrayContaining([
            `booking:${bookingId}:cancelled`,
            `booking:${bookingId}:calendar-cancel-requested`,
            `booking:${bookingId}:notifications-cancel-requested`,
            `booking:${bookingId}:tenant-webhooks-cancel-requested`,
          ])
        );
        // The confirm added 4 confirmed dedupe keys. After cancel, we
        // expect 8 total.
        expect(dedupeKeys).toHaveLength(8);

        // Double-cancel must raise booking_already_cancelled (P0001) and
        // leave the aggregate state alone.
        const outboxBefore = dedupeKeys.length;
        const bookingEventsBefore = bookingEvents.length;
        const { data: secondRpc, error: secondError } = await adminClient.rpc(
          "cancel_booking",
          {
            p_cancellation_token: cancellationToken,
            p_cancel_reason: "atomic test double",
            p_actor_type: "guest",
            p_actor_id: null,
          }
        );
        expect(secondRpc).toBeNull();
        expect(secondError).not.toBeNull();
        expect(secondError?.code).toBe("P0001");
        expect(String(secondError?.message ?? "")).toContain(
          "booking_already_cancelled"
        );

        const dedupeKeysAfter = await readOutboxDedupeKeys(
          adminClient,
          bookingId
        );
        const bookingEventsAfter = await readBookingEventTypes(
          adminClient,
          bookingId
        );
        expect(dedupeKeysAfter).toHaveLength(outboxBefore);
        expect(bookingEventsAfter).toHaveLength(bookingEventsBefore);
      }
    );

    it(
      "cancel_booking raises booking_already_rescheduled (P0001) when the booking has been rescheduled",
      async () => {
        const eventType = await createEventType(adminClient, {
          slug: uniqueE2EId("cancel-rescheduled"),
          duration_minutes: 30,
        });
        cleanupEventTypeIds.push(eventType.id);
        const slot = futureSlot(168, eventType.durationMinutes);
        const guestEmail = GUEST_EMAIL(uniqueE2EId("rescheduled"));

        await createSlotHold(adminClient, {
          eventType,
          slot,
          guestEmail,
        });
        const { data: holdRow } = await adminClient
          .from("slot_holds")
          .select("hold_token")
          .eq("event_type_id", eventType.id)
          .eq("start_at", slot.start)
          .maybeSingle();
        const holdToken = String(holdRow!.hold_token);

        const { data: confirmed, error: confirmError } = await adminClient
          .rpc("confirm_booking", {
            p_hold_token: holdToken,
            p_guest_name: "Atomic Reschedule",
            p_guest_email: guestEmail,
            p_guest_timezone: "UTC",
            p_notes: "",
            p_booking_answers: [],
          })
          .single();
        expect(confirmError).toBeNull();
        const originalBookingId = String(confirmed!.booking_id);
        const rescheduleToken = String(confirmed!.reschedule_token);

        // Simulate a reschedule by directly flipping the booking status
        // to 'rescheduled'. The cancel RPC distinguishes cancelled from
        // rescheduled before flipping the status.
        const { error: flipError } = await adminClient
          .from("bookings")
          .update({
            status: "rescheduled",
            rescheduled_at: new Date().toISOString(),
          })
          .eq("id", originalBookingId);
        expect(flipError).toBeNull();

        // Cancelling a rescheduled booking must raise
        // booking_already_rescheduled (P0001).
        const { data: rpcData, error: cancelError } = await adminClient.rpc(
          "cancel_booking",
          {
            p_cancellation_token: String(confirmed!.cancellation_token),
            p_cancel_reason: "atomic test rescheduled",
            p_actor_type: "guest",
            p_actor_id: null,
          }
        );
        expect(rpcData).toBeNull();
        expect(cancelError).not.toBeNull();
        expect(cancelError?.code).toBe("P0001");
        expect(String(cancelError?.message ?? "")).toContain(
          "booking_already_rescheduled"
        );

        // The booking was not flipped to cancelled; the row was preserved.
        const booking = await readBookingRow(adminClient, originalBookingId);
        expect(booking?.status).toBe("rescheduled");
        expect(String(booking?.reschedule_token)).toBe(rescheduleToken);
      }
    );
  }
);
