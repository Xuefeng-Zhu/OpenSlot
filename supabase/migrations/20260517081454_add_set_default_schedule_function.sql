-- Promote a schedule to the host default inside one database transaction.

CREATE OR REPLACE FUNCTION public.set_default_schedule(
  p_user_id UUID,
  p_schedule_id UUID,
  p_name TEXT DEFAULT NULL,
  p_update_name BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  timezone TEXT,
  is_default BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_update_name AND (
    p_name IS NULL
    OR length(btrim(p_name)) = 0
    OR char_length(btrim(p_name)) > 100
  ) THEN
    RAISE EXCEPTION 'Invalid schedule name' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.schedules AS schedules
    WHERE schedules.id = p_schedule_id
      AND schedules.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Schedule not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.schedules AS schedules
  SET
    is_default = false,
    updated_at = now()
  WHERE schedules.user_id = p_user_id
    AND schedules.is_default = true
    AND schedules.id <> p_schedule_id;

  RETURN QUERY
  UPDATE public.schedules AS schedules
  SET
    is_default = true,
    name = CASE WHEN p_update_name THEN btrim(p_name) ELSE schedules.name END,
    updated_at = now()
  WHERE schedules.id = p_schedule_id
    AND schedules.user_id = p_user_id
  RETURNING
    schedules.id,
    schedules.name,
    schedules.timezone,
    schedules.is_default;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_schedule(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_schedule(UUID, UUID, TEXT, BOOLEAN) TO service_role;
