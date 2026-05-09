-- Qualify expires_at references in the hold reservation RPC.
-- The function returns a column named expires_at, so unqualified column
-- references are ambiguous inside PL/pgSQL.
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
SET search_path = public, extensions
AS $$
DECLARE
  v_hold_id UUID := gen_random_uuid();
  v_hold_token UUID;
BEGIN
  UPDATE public.slot_holds
  SET status = 'expired'
  WHERE slot_holds.host_user_id = p_host_user_id
    AND slot_holds.status = 'active'
    AND slot_holds.expires_at <= now();

  UPDATE public.host_reservations
  SET status = 'expired',
      updated_at = now()
  WHERE host_reservations.host_user_id = p_host_user_id
    AND host_reservations.source = 'hold'
    AND host_reservations.status = 'active'
    AND host_reservations.expires_at <= now();

  INSERT INTO public.slot_holds (
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

  INSERT INTO public.host_reservations (
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
