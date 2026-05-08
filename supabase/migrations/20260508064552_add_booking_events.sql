-- Append-only booking lifecycle event ledger for auditability and future
-- webhook/event replay workflows.
CREATE TABLE booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_event_actor_type
    CHECK (actor_type IN ('system', 'host', 'guest')),
  CONSTRAINT booking_events_event_type_present
    CHECK (length(trim(event_type)) > 0)
);

CREATE INDEX idx_booking_events_booking_created
  ON booking_events(booking_id, created_at DESC);

CREATE INDEX idx_booking_events_event_type
  ON booking_events(event_type, created_at DESC);

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE booking_events TO service_role;
REVOKE ALL ON TABLE booking_events FROM anon, authenticated;
