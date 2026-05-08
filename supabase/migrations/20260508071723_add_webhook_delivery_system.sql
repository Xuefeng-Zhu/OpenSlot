-- Tenant webhook endpoints and retryable delivery attempts.
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subscribed_events TEXT[] NOT NULL DEFAULT '{}',
  secret_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_webhook_endpoint_url
    CHECK (url ~* '^https?://'),
  CONSTRAINT webhook_endpoint_has_subscriptions
    CHECK (cardinality(subscribed_events) > 0),
  CONSTRAINT unique_webhook_endpoint_url
    UNIQUE (profile_id, url)
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  outbox_event_id UUID REFERENCES outbox_events(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_no INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_code INTEGER,
  response_body TEXT,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_webhook_delivery_status
    CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'abandoned')),
  CONSTRAINT webhook_delivery_attempt_nonnegative
    CHECK (attempt_no >= 0),
  CONSTRAINT delivered_webhooks_have_delivered_at
    CHECK (status <> 'delivered' OR delivered_at IS NOT NULL),
  CONSTRAINT unique_webhook_delivery_event_endpoint
    UNIQUE (endpoint_id, outbox_event_id)
);

CREATE INDEX idx_webhook_endpoints_profile
  ON webhook_endpoints(profile_id, is_active);

CREATE INDEX idx_webhook_deliveries_due
  ON webhook_deliveries(status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_webhook_deliveries_endpoint
  ON webhook_deliveries(endpoint_id, created_at DESC);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE webhook_endpoints TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE webhook_deliveries TO service_role;

REVOKE ALL ON TABLE webhook_endpoints FROM anon, authenticated;
REVOKE ALL ON TABLE webhook_deliveries FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(
  p_limit INTEGER DEFAULT 10,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS SETOF public.webhook_deliveries
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate_deliveries AS (
    SELECT id
    FROM webhook_deliveries
    WHERE status IN ('pending', 'failed')
      AND next_attempt_at <= now()
      AND attempt_no < GREATEST(p_max_attempts, 1)
    ORDER BY next_attempt_at ASC, created_at ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE webhook_deliveries AS delivery
  SET
    status = 'processing',
    attempt_no = delivery.attempt_no + 1,
    last_error = NULL,
    updated_at = now()
  FROM candidate_deliveries
  WHERE delivery.id = candidate_deliveries.id
  RETURNING delivery.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(INTEGER, INTEGER) TO service_role;
