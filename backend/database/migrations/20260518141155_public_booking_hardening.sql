-- Public booking hardening: app-level rate limiting and scheduled hold expiry.
CREATE TABLE public.public_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  limit_count INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_rate_limits_window_seconds_positive
    CHECK (window_seconds > 0),
  CONSTRAINT public_rate_limits_limit_count_positive
    CHECK (limit_count > 0),
  CONSTRAINT public_rate_limits_request_count_nonnegative
    CHECK (request_count >= 0)
);

CREATE UNIQUE INDEX ux_public_rate_limits_scope_identifier_window
  ON public.public_rate_limits(scope, identifier_hash, window_start);

CREATE INDEX idx_public_rate_limits_expires_at
  ON public.public_rate_limits(expires_at);

ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  p_scope TEXT,
  p_identifier_hash TEXT,
  p_limit_count INTEGER,
  p_window_seconds INTEGER,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  allowed BOOLEAN,
  limit_count INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_reset_at TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  IF p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'Rate limit scope is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_identifier_hash IS NULL OR btrim(p_identifier_hash) = '' THEN
    RAISE EXCEPTION 'Rate limit identifier hash is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_limit_count IS NULL OR p_limit_count < 1 THEN
    RAISE EXCEPTION 'Rate limit count must be positive'
      USING ERRCODE = '22023';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Rate limit window must be positive'
      USING ERRCODE = '22023';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM p_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  DELETE FROM public.public_rate_limits
  WHERE expires_at <= p_now;

  INSERT INTO public.public_rate_limits (
    scope,
    identifier_hash,
    window_start,
    window_seconds,
    limit_count,
    request_count,
    expires_at,
    created_at,
    updated_at
  )
  VALUES (
    p_scope,
    p_identifier_hash,
    v_window_start,
    p_window_seconds,
    p_limit_count,
    1,
    v_reset_at,
    p_now,
    p_now
  )
  ON CONFLICT (scope, identifier_hash, window_start)
  DO UPDATE SET
    request_count = public.public_rate_limits.request_count + 1,
    limit_count = EXCLUDED.limit_count,
    window_seconds = EXCLUDED.window_seconds,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at
  RETURNING public.public_rate_limits.request_count
  INTO v_request_count;

  RETURN QUERY SELECT
    v_request_count <= p_limit_count,
    p_limit_count,
    greatest(p_limit_count - v_request_count, 0),
    v_reset_at,
    CASE
      WHEN v_request_count <= p_limit_count THEN 0
      ELSE greatest(ceil(extract(epoch FROM (v_reset_at - p_now)))::INTEGER, 1)
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_slot_holds(
  p_limit INTEGER DEFAULT 500,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  expired_holds INTEGER,
  expired_reservations INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := least(greatest(coalesce(p_limit, 500), 1), 1000);
  v_expired_holds INTEGER;
  v_expired_reservations INTEGER;
BEGIN
  WITH candidate_holds AS (
    SELECT id
    FROM public.slot_holds
    WHERE status = 'active'
      AND expires_at <= p_now
    ORDER BY expires_at, created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated_holds AS (
    UPDATE public.slot_holds
    SET status = 'expired'
    FROM candidate_holds
    WHERE slot_holds.id = candidate_holds.id
    RETURNING slot_holds.id
  )
  SELECT count(*)::INTEGER
  INTO v_expired_holds
  FROM updated_holds;

  WITH candidate_reservations AS (
    SELECT id
    FROM public.host_reservations
    WHERE source = 'hold'
      AND status = 'active'
      AND expires_at <= p_now
    ORDER BY expires_at, created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated_reservations AS (
    UPDATE public.host_reservations
    SET status = 'expired',
        updated_at = p_now
    FROM candidate_reservations
    WHERE host_reservations.id = candidate_reservations.id
    RETURNING host_reservations.id
  )
  SELECT count(*)::INTEGER
  INTO v_expired_reservations
  FROM updated_reservations;

  RETURN QUERY SELECT v_expired_holds, v_expired_reservations;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_rate_limits TO service_role;

REVOKE ALL ON TABLE public.public_rate_limits FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_public_rate_limit(
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  TIMESTAMPTZ
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_slot_holds(
  INTEGER,
  TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  TIMESTAMPTZ
) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_slot_holds(
  INTEGER,
  TIMESTAMPTZ
) TO service_role;
