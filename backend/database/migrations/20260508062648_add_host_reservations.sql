-- Host reservations are the database-level collision guard for active holds
-- and confirmed bookings. They let hold creation fail atomically under races.
CREATE TABLE host_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_id UUID NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_host_reservation_source
    CHECK (source IN ('hold', 'booking')),
  CONSTRAINT valid_host_reservation_status
    CHECK (status IN ('active', 'released', 'expired', 'cancelled')),
  CONSTRAINT valid_host_reservation_range
    CHECK (start_at < end_at),
  CONSTRAINT hold_reservations_have_expiry
    CHECK (source <> 'hold' OR expires_at IS NOT NULL),
  CONSTRAINT booking_reservations_do_not_expire
    CHECK (source <> 'booking' OR expires_at IS NULL),
  CONSTRAINT unique_host_reservation_source
    UNIQUE (source, source_id),
  CONSTRAINT host_reservations_no_overlap
    EXCLUDE USING gist (
      host_user_id WITH =,
      tstzrange(start_at, end_at) WITH &&
    ) WHERE (status = 'active')
);

CREATE INDEX idx_host_reservations_active_expiry
  ON host_reservations(expires_at)
  WHERE source = 'hold' AND status = 'active';

CREATE INDEX idx_host_reservations_source
  ON host_reservations(source, source_id);

ALTER TABLE host_reservations ENABLE ROW LEVEL SECURITY;

INSERT INTO host_reservations (
  host_user_id,
  source,
  source_id,
  start_at,
  end_at,
  status,
  expires_at,
  created_at,
  updated_at
)
SELECT
  host_user_id,
  'booking',
  id,
  start_at,
  end_at,
  'active',
  NULL,
  created_at,
  updated_at
FROM bookings
WHERE status = 'confirmed'
ON CONFLICT DO NOTHING;

INSERT INTO host_reservations (
  host_user_id,
  source,
  source_id,
  start_at,
  end_at,
  status,
  expires_at,
  created_at,
  updated_at
)
SELECT
  host_user_id,
  'hold',
  id,
  start_at,
  end_at,
  'active',
  expires_at,
  created_at,
  now()
FROM slot_holds
WHERE status = 'active' AND expires_at > now()
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_slot_hold_with_reservation(
  p_event_type_id UUID,
  p_host_user_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_guest_email TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS TABLE (
  hold_id UUID,
  hold_token UUID,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_hold_id UUID := gen_random_uuid();
  v_hold_token UUID;
BEGIN
  UPDATE slot_holds
  SET status = 'expired'
  WHERE host_user_id = p_host_user_id
    AND status = 'active'
    AND expires_at <= now();

  UPDATE host_reservations
  SET status = 'expired',
      updated_at = now()
  WHERE host_user_id = p_host_user_id
    AND source = 'hold'
    AND status = 'active'
    AND expires_at <= now();

  INSERT INTO slot_holds (
    id,
    event_type_id,
    host_user_id,
    start_at,
    end_at,
    guest_email,
    expires_at,
    status
  )
  VALUES (
    v_hold_id,
    p_event_type_id,
    p_host_user_id,
    p_start_at,
    p_end_at,
    p_guest_email,
    p_expires_at,
    'active'
  )
  RETURNING slot_holds.hold_token INTO v_hold_token;

  INSERT INTO host_reservations (
    host_user_id,
    source,
    source_id,
    start_at,
    end_at,
    status,
    expires_at
  )
  VALUES (
    p_host_user_id,
    'hold',
    v_hold_id,
    p_start_at,
    p_end_at,
    'active',
    p_expires_at
  );

  RETURN QUERY SELECT v_hold_id, v_hold_token, p_expires_at;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE host_reservations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE slot_holds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bookings TO service_role;

REVOKE ALL ON FUNCTION public.create_slot_hold_with_reservation(
  UUID,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_slot_hold_with_reservation(
  UUID,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON TABLE host_reservations FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.create_slot_hold_with_reservation(
  UUID,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ
) FROM anon, authenticated;
