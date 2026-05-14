-- Video conferencing v1. Event types can request generated Google Meet or
-- Microsoft Teams links; bookings snapshot that choice so retries and emails do
-- not depend on later event-type edits.
ALTER TABLE event_types
  ADD COLUMN video_provider TEXT;

ALTER TABLE event_types
  DROP CONSTRAINT IF EXISTS valid_location_type;

ALTER TABLE event_types
  ADD CONSTRAINT valid_location_type
  CHECK (location_type IN ('online', 'phone', 'in_person', 'custom', 'video_provider')),
  ADD CONSTRAINT valid_event_type_video_provider
  CHECK (
    (
      location_type = 'video_provider'
      AND video_provider IN ('google_meet', 'microsoft_teams')
    )
    OR (
      location_type <> 'video_provider'
      AND video_provider IS NULL
    )
  );

ALTER TABLE bookings
  ADD COLUMN location_type TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN location_value TEXT NOT NULL DEFAULT '',
  ADD COLUMN conference_provider TEXT,
  ADD COLUMN conference_url TEXT,
  ADD COLUMN conference_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN conference_error TEXT;

UPDATE bookings AS booking
SET
  location_type = event_type.location_type,
  location_value = COALESCE(event_type.location_value, ''),
  conference_provider = CASE
    WHEN event_type.location_type = 'video_provider' THEN event_type.video_provider
    ELSE NULL
  END,
  conference_status = CASE
    WHEN event_type.location_type = 'video_provider' THEN 'pending'
    ELSE 'not_required'
  END
FROM event_types AS event_type
WHERE booking.event_type_id = event_type.id;

ALTER TABLE bookings
  ADD CONSTRAINT valid_booking_location_type
  CHECK (location_type IN ('online', 'phone', 'in_person', 'custom', 'video_provider')),
  ADD CONSTRAINT valid_booking_conference_provider
  CHECK (conference_provider IS NULL OR conference_provider IN ('google_meet', 'microsoft_teams')),
  ADD CONSTRAINT valid_booking_conference_status
  CHECK (conference_status IN ('not_required', 'pending', 'ready', 'setup_required', 'failed')),
  ADD CONSTRAINT valid_booking_conference_state
  CHECK (
    (
      location_type = 'video_provider'
      AND conference_provider IN ('google_meet', 'microsoft_teams')
      AND conference_status IN ('pending', 'ready', 'setup_required', 'failed')
    )
    OR (
      location_type <> 'video_provider'
      AND conference_provider IS NULL
      AND conference_status = 'not_required'
    )
  ),
  ADD CONSTRAINT ready_bookings_have_conference_url
  CHECK (conference_status <> 'ready' OR conference_url IS NOT NULL);

CREATE INDEX idx_bookings_conference_status
  ON bookings(conference_status)
  WHERE conference_status IN ('pending', 'setup_required', 'failed');

DROP FUNCTION IF EXISTS public.reschedule_booking_with_hold(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);

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
  reschedule_token UUID,
  conference_status TEXT,
  conference_url TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_booking bookings%ROWTYPE;
  v_hold slot_holds%ROWTYPE;
  v_event_type event_types%ROWTYPE;
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

  SELECT *
  INTO v_event_type
  FROM event_types
  WHERE id = v_hold.event_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_type_not_found' USING ERRCODE = 'P0002';
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
    rescheduled_from_booking_id,
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
    v_hold.start_at,
    v_hold.end_at,
    'confirmed',
    v_old_booking.id,
    v_event_type.location_type,
    COALESCE(v_event_type.location_value, ''),
    CASE
      WHEN v_event_type.location_type = 'video_provider' THEN v_event_type.video_provider
      ELSE NULL
    END,
    CASE
      WHEN v_event_type.location_type = 'video_provider' THEN 'pending'
      ELSE 'not_required'
    END,
    NULL
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
    v_new_booking.reschedule_token,
    v_new_booking.conference_status,
    v_new_booking.conference_url;
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
