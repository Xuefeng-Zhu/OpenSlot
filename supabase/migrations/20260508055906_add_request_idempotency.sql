-- Request-level idempotency ledger for retry-safe public booking mutations.
CREATE TABLE request_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  response_json JSONB,
  response_status INTEGER,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_request_idempotency_status
    CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT completed_request_idempotency_has_response
    CHECK (
      status = 'in_progress'
      OR (response_json IS NOT NULL AND response_status IS NOT NULL)
    ),
  CONSTRAINT request_idempotency_response_status_range
    CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599)
);

CREATE UNIQUE INDEX ux_request_idempotency_scope_key
  ON request_idempotency(scope, idempotency_key);

CREATE INDEX idx_request_idempotency_expires_at
  ON request_idempotency(expires_at);

ALTER TABLE request_idempotency ENABLE ROW LEVEL SECURITY;
