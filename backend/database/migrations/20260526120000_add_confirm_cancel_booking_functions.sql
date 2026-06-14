-- Atomic booking confirmation and cancellation RPCs.
--
-- This migration closes the "Booking transaction boundaries" row in
-- docs/system-design-gaps.md. Previously, confirming or cancelling a booking
-- was a multi-step service-role call sequence from application code: insert or
-- update the booking row, mutate the matching host_reservation, append a
-- booking_events row, then enqueue outbox_events rows. A failure between any
-- two steps could leave partial state behind.
--
-- Both RPCs in this file perform the following work inside ONE database
-- transaction:
--
--   * bookings row write (insert or status flip)
--   * matching host_reservations row write
--   * booking_events audit row
--   * four (or five, when a reminder fires) outbox_events rows with the same
--     deterministic dedupe keys the JS helper at src/lib/outbox/outbox.ts uses,
--     so retries remain safe via ON CONFLICT (dedupe_key) DO NOTHING.
--
-- The bookings.no_overlapping_bookings exclusion constraint propagates
-- uncaught (Postgres SQLSTATE 23P01) when a confirmed booking overlaps another
-- confirmed booking for the same host. The TypeScript lib at
-- src/lib/booking/confirm.ts already maps error.code === '23P01' to a 409
-- "This slot has been booked by someone else" response, so we deliberately do
-- not translate the violation inside this function; the RPC stays the single
-- source of truth for that contract.
--
-- Slot holds do not have an updated_at column on disk, so the
-- slot_holds UPDATE intentionally does not set one (mirrors
-- 20260508070850_add_booking_reschedule_flow.sql).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_hold_token UUID,
  p_guest_name TEXT,
  p_guest_email TEXT,
  p_guest_timezone TEXT,
  p_notes TEXT,
  p_booking_answers JSONB
)
RETURNS TABLE (
  booking_id UUID,
  cancellation_token UUID,
  reschedule_token UUID,
  conference_status TEXT,
  conference_url TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_hold slot_holds%ROWTYPE;
  v_event_type event_types%ROWTYPE;
  v_booking bookings%ROWTYPE;
  v_conference_provider TEXT;
  v_conference_status TEXT;
  v_booking_payload JSONB;
BEGIN
  -- Lock the hold row first so a concurrent confirm/cancel cannot race.
  SELECT *
  INTO v_hold
  FROM slot_holds
  WHERE slot_holds.hold_token = p_hold_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hold_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency short-circuit. Anything other than an active, unexpired hold
  -- fails fast BEFORE the bookings insert so we never burn a booking id or
  -- outbox rows on a hold that has already been consumed.
  IF v_hold.status <> 'active' THEN
    RAISE EXCEPTION 'hold_already_used' USING ERRCODE = 'P0001';
  END IF;

  IF v_hold.expires_at <= now() THEN
    UPDATE slot_holds
    SET status = 'expired'
    WHERE id = v_hold.id;

    UPDATE host_reservations
    SET status = 'expired',
        updated_at = now()
    WHERE source = 'hold'
      AND source_id = v_hold.id
      AND status = 'active';

    RAISE EXCEPTION 'hold_expired' USING ERRCODE = 'P0001';
  END IF;

  -- Event types are quasi-immutable for the duration of this call. A plain
  -- SELECT is enough; the row is not contending with the booking write.
  SELECT *
  INTO v_event_type
  FROM event_types
  WHERE id = v_hold.event_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_type_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_conference_provider := CASE
    WHEN v_event_type.location_type = 'video_provider' THEN v_event_type.video_provider
    ELSE NULL
  END;

  v_conference_status := CASE
    WHEN v_conference_provider IS NOT NULL THEN 'pending'
    ELSE 'not_required'
  END;

  -- Insert the confirmed booking. The no_overlapping_bookings exclusion
  -- constraint will fire (SQLSTATE 23P01) on a conflict with an existing
  -- confirmed booking for the same host/time; the lib maps that to a 409.
  INSERT INTO bookings (
    event_type_id,
    host_user_id,
    guest_name,
    guest_email,
    guest_timezone,
    notes,
    booking_answers,
    start_at,
    end_at,
    status,
    location_type,
    location_value,
    conference_provider,
    conference_status,
    conference_error
  )
  VALUES (
    v_hold.event_type_id,
    v_hold.host_user_id,
    p_guest_name,
    p_guest_email,
    p_guest_timezone,
    COALESCE(p_notes, ''),
    COALESCE(p_booking_answers, '[]'::jsonb),
    v_hold.start_at,
    v_hold.end_at,
    'confirmed',
    v_event_type.location_type,
    COALESCE(v_event_type.location_value, ''),
    v_conference_provider,
    v_conference_status,
    NULL
  )
  RETURNING * INTO v_booking;

  UPDATE slot_holds
  SET status = 'confirmed'
  WHERE id = v_hold.id;

  UPDATE host_reservations
  SET source = 'booking',
      source_id = v_booking.id,
      expires_at = NULL,
      updated_at = now()
  WHERE source = 'hold'
    AND source_id = v_hold.id
    AND status = 'active';

  INSERT INTO booking_events (
    booking_id,
    event_type,
    actor_type,
    actor_id,
    payload
  )
  VALUES (
    v_booking.id,
    'booking.confirmed',
    'guest',
    NULL,
    jsonb_build_object(
      'event_type_id', v_booking.event_type_id,
      'host_user_id', v_booking.host_user_id,
      'start_at', v_booking.start_at,
      'end_at', v_booking.end_at
    )
  );

  v_booking_payload := jsonb_build_object(
    'bookingId', v_booking.id,
    'eventTypeId', v_booking.event_type_id,
    'hostUserId', v_booking.host_user_id,
    'startAt', v_booking.start_at,
    'endAt', v_booking.end_at
  );

  INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, dedupe_key)
  VALUES
    ('booking', v_booking.id, 'booking.confirmed', v_booking_payload, 'booking:' || v_booking.id || ':confirmed'),
    ('booking', v_booking.id, 'calendar.write.requested', v_booking_payload, 'booking:' || v_booking.id || ':calendar-write-requested'),
    ('booking', v_booking.id, 'notifications.requested', v_booking_payload, 'booking:' || v_booking.id || ':notifications-requested'),
    ('booking', v_booking.id, 'tenant.webhooks.requested', v_booking_payload, 'booking:' || v_booking.id || ':tenant-webhooks-requested')
  ON CONFLICT (dedupe_key) DO NOTHING;

  -- Optional pre-meeting reminder. Disabled / partial policies are a no-op so
  -- booking confirmation never blocks on reminder setup.
  IF v_event_type.reminder_enabled = true
     AND (v_event_type.reminder_guest_enabled = true OR v_event_type.reminder_host_enabled = true)
     AND v_event_type.reminder_minutes_before IS NOT NULL THEN
    INSERT INTO outbox_events (
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      dedupe_key,
      available_at
    )
    VALUES (
      'booking',
      v_booking.id,
      'notifications.reminder.requested',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at,
        'reminderMinutesBefore', v_event_type.reminder_minutes_before,
        'channels', jsonb_build_object(
          'guest', v_event_type.reminder_guest_enabled,
          'host', v_event_type.reminder_host_enabled
        )
      ),
      'booking:' || v_booking.id || ':notifications-reminder-requested',
      v_booking.start_at - (v_event_type.reminder_minutes_before * interval '1 minute')
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT
    v_booking.id,
    v_booking.cancellation_token,
    v_booking.reschedule_token,
    v_booking.conference_status,
    v_booking.conference_url;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_booking(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.confirm_booking(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO service_role;


CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_cancellation_token UUID,
  p_cancel_reason TEXT,
  p_actor_type TEXT,
  p_actor_id UUID
)
RETURNS TABLE (booking_id UUID)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_payload JSONB;
BEGIN
  -- Defensive enum check. booking_events.actor_type is constrained to
  -- ('system', 'host', 'guest') so a bad value would fail the audit insert
  -- with a generic check_violation; surface a clean code instead.
  IF p_actor_type NOT IN ('guest', 'host', 'system') THEN
    RAISE EXCEPTION 'invalid_actor_type' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_booking
  FROM bookings
  WHERE bookings.cancellation_token = p_cancellation_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Status checks must precede the bookings update so each failure mode maps
  -- to a distinct error code that the lib can surface.
  IF v_booking.status = 'cancelled' THEN
    RAISE EXCEPTION 'booking_already_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_booking.status = 'rescheduled' THEN
    RAISE EXCEPTION 'booking_already_rescheduled' USING ERRCODE = 'P0001';
  END IF;

  UPDATE bookings
  SET status = 'cancelled',
      cancel_reason = COALESCE(p_cancel_reason, cancel_reason),
      updated_at = now()
  WHERE id = v_booking.id;

  UPDATE host_reservations
  SET status = 'cancelled',
      updated_at = now()
  WHERE source = 'booking'
    AND source_id = v_booking.id
    AND status = 'active';

  INSERT INTO booking_events (
    booking_id,
    event_type,
    actor_type,
    actor_id,
    payload
  )
  VALUES (
    v_booking.id,
    'booking.cancelled',
    p_actor_type,
    p_actor_id,
    jsonb_build_object(
      'event_type_id', v_booking.event_type_id,
      'host_user_id', v_booking.host_user_id,
      'start_at', v_booking.start_at,
      'end_at', v_booking.end_at,
      'cancelReasonProvided', p_cancel_reason IS NOT NULL
    )
  );

  v_payload := jsonb_build_object(
    'bookingId', v_booking.id,
    'eventTypeId', v_booking.event_type_id,
    'hostUserId', v_booking.host_user_id,
    'startAt', v_booking.start_at,
    'endAt', v_booking.end_at,
    'cancelReasonProvided', p_cancel_reason IS NOT NULL
  );

  INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, dedupe_key)
  VALUES
    ('booking', v_booking.id, 'booking.cancelled', v_payload, 'booking:' || v_booking.id || ':cancelled'),
    ('booking', v_booking.id, 'calendar.cancel.requested', v_payload, 'booking:' || v_booking.id || ':calendar-cancel-requested'),
    ('booking', v_booking.id, 'notifications.cancel.requested', v_payload, 'booking:' || v_booking.id || ':notifications-cancel-requested'),
    ('booking', v_booking.id, 'tenant.webhooks.cancel.requested', v_payload, 'booking:' || v_booking.id || ':tenant-webhooks-cancel-requested')
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN QUERY SELECT v_booking.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_booking(
  UUID,
  TEXT,
  TEXT,
  UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cancel_booking(
  UUID,
  TEXT,
  TEXT,
  UUID
) TO service_role;
