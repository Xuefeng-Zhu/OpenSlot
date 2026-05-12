-- Booking confirmation and cancellation are critical state transitions. Keep
-- booking rows, reservation mirrors, audit events, and side-effect outbox rows
-- inside one PostgreSQL statement transaction so a later write cannot leave
-- partially promoted or partially cancelled state behind.
CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(
  p_hold_token UUID,
  p_guest_name TEXT,
  p_guest_email TEXT,
  p_guest_timezone TEXT,
  p_notes TEXT DEFAULT ''
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  booking_id UUID,
  cancellation_token UUID,
  reschedule_token UUID
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_hold slot_holds%ROWTYPE;
  v_booking bookings%ROWTYPE;
  v_payload JSONB;
BEGIN
  SELECT *
  INTO v_hold
  FROM slot_holds
  WHERE slot_holds.hold_token = p_hold_token
  FOR UPDATE;

  IF NOT FOUND OR v_hold.status <> 'active' THEN
    RETURN QUERY SELECT false, 'hold_not_found'::TEXT, NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
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

    RETURN QUERY SELECT false, 'hold_expired'::TEXT, NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO bookings (
    event_type_id,
    host_user_id,
    guest_name,
    guest_email,
    guest_timezone,
    notes,
    start_at,
    end_at,
    status
  )
  VALUES (
    v_hold.event_type_id,
    v_hold.host_user_id,
    p_guest_name,
    p_guest_email,
    p_guest_timezone,
    COALESCE(p_notes, ''),
    v_hold.start_at,
    v_hold.end_at,
    'confirmed'
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_payload := jsonb_build_object(
    'eventTypeId', v_hold.event_type_id,
    'hostUserId', v_hold.host_user_id,
    'startAt', v_hold.start_at,
    'endAt', v_hold.end_at
  );

  INSERT INTO booking_events (
    booking_id,
    event_type,
    actor_type,
    payload
  )
  VALUES (
    v_booking.id,
    'booking.confirmed',
    'system',
    v_payload
  );

  INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    dedupe_key
  )
  VALUES
    (
      'booking',
      v_booking.id,
      'booking.confirmed',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at
      ),
      'booking:' || v_booking.id::TEXT || ':confirmed'
    ),
    (
      'booking',
      v_booking.id,
      'calendar.write.requested',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at
      ),
      'booking:' || v_booking.id::TEXT || ':calendar-write-requested'
    ),
    (
      'booking',
      v_booking.id,
      'notifications.requested',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at
      ),
      'booking:' || v_booking.id::TEXT || ':notifications-requested'
    ),
    (
      'booking',
      v_booking.id,
      'tenant.webhooks.requested',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at
      ),
      'booking:' || v_booking.id::TEXT || ':tenant-webhooks-requested'
    )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    v_booking.id,
    v_booking.cancellation_token,
    v_booking.reschedule_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_token(
  p_cancellation_token UUID,
  p_cancel_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  booking_id UUID
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_payload JSONB;
BEGIN
  SELECT *
  INTO v_booking
  FROM bookings
  WHERE bookings.cancellation_token = p_cancellation_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'booking_not_found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN QUERY SELECT false, 'booking_already_cancelled'::TEXT, v_booking.id;
    RETURN;
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RETURN QUERY SELECT false, 'booking_not_found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  UPDATE bookings
  SET status = 'cancelled',
      cancel_reason = p_cancel_reason,
      updated_at = now()
  WHERE id = v_booking.id;

  UPDATE host_reservations
  SET status = 'cancelled',
      updated_at = now()
  WHERE source = 'booking'
    AND source_id = v_booking.id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_payload := jsonb_build_object(
    'eventTypeId', v_booking.event_type_id,
    'hostUserId', v_booking.host_user_id,
    'startAt', v_booking.start_at,
    'endAt', v_booking.end_at,
    'cancelReasonProvided', p_cancel_reason IS NOT NULL AND length(trim(p_cancel_reason)) > 0
  );

  INSERT INTO booking_events (
    booking_id,
    event_type,
    actor_type,
    payload
  )
  VALUES (
    v_booking.id,
    'booking.cancelled',
    'guest',
    v_payload
  );

  INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    dedupe_key
  )
  VALUES
    (
      'booking',
      v_booking.id,
      'booking.cancelled',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at,
        'cancelReasonProvided', p_cancel_reason IS NOT NULL AND length(trim(p_cancel_reason)) > 0
      ),
      'booking:' || v_booking.id::TEXT || ':cancelled'
    ),
    (
      'booking',
      v_booking.id,
      'calendar.cancel.requested',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at,
        'cancelReasonProvided', p_cancel_reason IS NOT NULL AND length(trim(p_cancel_reason)) > 0
      ),
      'booking:' || v_booking.id::TEXT || ':calendar-cancel-requested'
    ),
    (
      'booking',
      v_booking.id,
      'notifications.cancel.requested',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at,
        'cancelReasonProvided', p_cancel_reason IS NOT NULL AND length(trim(p_cancel_reason)) > 0
      ),
      'booking:' || v_booking.id::TEXT || ':notifications-cancel-requested'
    ),
    (
      'booking',
      v_booking.id,
      'tenant.webhooks.cancel.requested',
      jsonb_build_object(
        'bookingId', v_booking.id,
        'eventTypeId', v_booking.event_type_id,
        'hostUserId', v_booking.host_user_id,
        'startAt', v_booking.start_at,
        'endAt', v_booking.end_at,
        'cancelReasonProvided', p_cancel_reason IS NOT NULL AND length(trim(p_cancel_reason)) > 0
      ),
      'booking:' || v_booking.id::TEXT || ':tenant-webhooks-cancel-requested'
    )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN QUERY SELECT true, NULL::TEXT, v_booking.id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_booking_from_hold(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_booking_from_hold(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_booking_by_token(
  UUID,
  TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token(
  UUID,
  TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.confirm_booking_from_hold(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_booking_by_token(
  UUID,
  TEXT
) FROM anon, authenticated;
