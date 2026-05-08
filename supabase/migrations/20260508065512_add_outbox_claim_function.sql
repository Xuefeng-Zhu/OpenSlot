-- Atomically lease outbox work for a worker without letting two workers process
-- the same row. Failed rows are retried after available_at until max attempts.
CREATE OR REPLACE FUNCTION public.claim_outbox_events(
  p_limit INTEGER DEFAULT 10,
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate_events AS (
    SELECT id
    FROM outbox_events
    WHERE status IN ('pending', 'failed')
      AND available_at <= now()
      AND attempts < GREATEST(p_max_attempts, 1)
    ORDER BY available_at ASC, created_at ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE outbox_events AS event
  SET
    status = 'processing',
    attempts = event.attempts + 1,
    last_error = NULL,
    updated_at = now()
  FROM candidate_events
  WHERE event.id = candidate_events.id
  RETURNING event.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outbox_events(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(INTEGER, INTEGER) TO service_role;
