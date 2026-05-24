-- Token-based guest rescheduling. The RPC keeps the old booking transition,
-- new booking insert, hold conversion, and reservation release in one database
-- transaction.
ALTER TABLE bookings
  ADD COLUMN rescheduled_from_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN rescheduled_to_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN rescheduled_at TIMESTAMPTZ;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS valid_booking_status;

ALTER TABLE bookings
  ADD CONSTRAINT valid_booking_status
  CHECK (status IN ('confirmed', 'cancelled', 'rescheduled'));

CREATE INDEX idx_bookings_rescheduled_from
  ON bookings(rescheduled_from_booking_id)
  WHERE rescheduled_from_booking_id IS NOT NULL;

CREATE INDEX idx_bookings_rescheduled_to
  ON bookings(rescheduled_to_booking_id)
  WHERE rescheduled_to_booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reschedule_booking_with_hold(
  p_reschedule_token UUID,
  p_hold_token UUID,
  p_guest_name TEXT,
  p_guest_email TEXT,
  p_guest_timezone TEXT,
  p_notes TEXT DEFAULT ''
)
RETURNS TABLE (
  old_booking_id UUID,
  new_booking_id UUID,
  event_type_id UUID,
  host_user_id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  previous_start_at TIMESTAMPTZ,
  previous_end_at TIMESTAMPTZ,
  cancellation_token UUID,
  reschedule_token UUID
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_booking bookings%ROWTYPE;
  v_hold slot_holds%ROWTYPE;
  v_new_booking bookings%ROWTYPE;
BEGIN
  SELECT *
  INTO v_old_booking
  FROM bookings
  WHERE bookings.reschedule_token = p_reschedule_token
  FOR UPDATE;

  IF NOT FOUND OR v_old_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_hold
  FROM slot_holds
  WHERE slot_holds.hold_token = p_hold_token
  FOR UPDATE;

  IF NOT FOUND OR v_hold.status <> 'active' THEN
    RAISE EXCEPTION 'hold_not_found' USING ERRCODE = 'P0002';
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

  IF v_hold.event_type_id <> v_old_booking.event_type_id
     OR v_hold.host_user_id <> v_old_booking.host_user_id THEN
    RAISE EXCEPTION 'hold_does_not_match_booking' USING ERRCODE = 'P0001';
  END IF;

  UPDATE bookings
  SET status = 'rescheduled',
      rescheduled_at = now(),
      updated_at = now()
  WHERE id = v_old_booking.id;

  UPDATE host_reservations
  SET status = 'cancelled',
      updated_at = now()
  WHERE source = 'booking'
    AND source_id = v_old_booking.id
    AND status = 'active';

  INSERT INTO bookings (
    event_type_id,
    host_user_id,
    guest_name,
    guest_email,
    guest_timezone,
    notes,
    start_at,
    end_at,
    status,
    rescheduled_from_booking_id
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
    'confirmed',
    v_old_booking.id
  )
  RETURNING * INTO v_new_booking;

  UPDATE bookings
  SET rescheduled_to_booking_id = v_new_booking.id,
      updated_at = now()
  WHERE id = v_old_booking.id;

  UPDATE slot_holds
  SET status = 'confirmed'
  WHERE id = v_hold.id;

  UPDATE host_reservations
  SET source = 'booking',
      source_id = v_new_booking.id,
      expires_at = NULL,
      updated_at = now()
  WHERE source = 'hold'
    AND source_id = v_hold.id
    AND status = 'active';

  RETURN QUERY SELECT
    v_old_booking.id,
    v_new_booking.id,
    v_new_booking.event_type_id,
    v_new_booking.host_user_id,
    v_new_booking.start_at,
    v_new_booking.end_at,
    v_old_booking.start_at,
    v_old_booking.end_at,
    v_new_booking.cancellation_token,
    v_new_booking.reschedule_token;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_booking_with_hold(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reschedule_booking_with_hold(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO service_role;
