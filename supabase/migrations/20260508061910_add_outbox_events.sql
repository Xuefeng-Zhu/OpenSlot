-- Internal side-effect ledger for retryable provider writes, notifications,
-- and future tenant webhook dispatch.
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_outbox_event_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT outbox_events_attempts_nonnegative
    CHECK (attempts >= 0),
  CONSTRAINT completed_outbox_events_have_processed_at
    CHECK (status <> 'completed' OR processed_at IS NOT NULL)
);

CREATE UNIQUE INDEX ux_outbox_events_dedupe_key
  ON outbox_events(dedupe_key);

CREATE INDEX idx_outbox_events_available
  ON outbox_events(status, available_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_outbox_events_aggregate
  ON outbox_events(aggregate_type, aggregate_id);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;

-- Newer Supabase projects may not expose public tables to the Data API by
-- default. Internal ledgers are only accessed by server-side service-role code.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE request_idempotency TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE outbox_events TO service_role;

REVOKE ALL ON TABLE outbox_events FROM anon, authenticated;
