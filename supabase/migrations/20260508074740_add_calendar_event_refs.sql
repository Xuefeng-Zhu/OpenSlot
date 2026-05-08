-- External calendar events created by OpenSlot. These rows let retries and
-- cancellations repair provider state without storing provider details on the
-- booking row itself.
CREATE TABLE calendar_event_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_calendar_id UUID NOT NULL REFERENCES provider_calendars(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  provider_event_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_calendar_event_ref_status
    CHECK (status IN ('active', 'cancelled')),
  CONSTRAINT unique_calendar_event_ref_booking
    UNIQUE (provider_calendar_id, booking_id),
  CONSTRAINT unique_calendar_event_ref_external_event
    UNIQUE (provider_calendar_id, external_event_id)
);

CREATE INDEX idx_calendar_event_refs_booking_status
  ON calendar_event_refs(booking_id, status);

ALTER TABLE calendar_event_refs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE calendar_event_refs TO service_role;
REVOKE ALL ON TABLE calendar_event_refs FROM anon, authenticated;
