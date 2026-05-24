-- Introduce host-owned availability schedule containers and attach existing
-- event types/rules/overrides to each host's default schedule.

CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedules_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT schedules_name_length CHECK (char_length(name) <= 100),
  CONSTRAINT schedules_user_id_id_unique UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS schedules_one_default_per_user
  ON public.schedules(user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS schedules_user_id_idx ON public.schedules(user_id);

INSERT INTO public.schedules (user_id, name, timezone, is_default)
SELECT
  profiles.id,
  'Default schedule',
  COALESCE(
    (
      SELECT availability_rules.timezone
      FROM public.availability_rules
      WHERE availability_rules.user_id = profiles.id
      ORDER BY availability_rules.created_at ASC
      LIMIT 1
    ),
    (
      SELECT availability_overrides.timezone
      FROM public.availability_overrides
      WHERE availability_overrides.user_id = profiles.id
      ORDER BY availability_overrides.created_at ASC
      LIMIT 1
    ),
    profiles.default_timezone,
    'UTC'
  ),
  true
FROM public.profiles
ON CONFLICT DO NOTHING;

ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS schedule_id UUID;

ALTER TABLE public.availability_rules
  ADD COLUMN IF NOT EXISTS schedule_id UUID;

ALTER TABLE public.availability_overrides
  ADD COLUMN IF NOT EXISTS schedule_id UUID;

UPDATE public.event_types
SET schedule_id = schedules.id
FROM public.schedules
WHERE schedules.user_id = event_types.user_id
  AND schedules.is_default = true;

UPDATE public.availability_rules
SET schedule_id = schedules.id
FROM public.schedules
WHERE schedules.user_id = availability_rules.user_id
  AND schedules.is_default = true;

UPDATE public.availability_overrides
SET schedule_id = schedules.id
FROM public.schedules
WHERE schedules.user_id = availability_overrides.user_id
  AND schedules.is_default = true;

ALTER TABLE public.event_types
  ALTER COLUMN schedule_id SET NOT NULL;

ALTER TABLE public.availability_rules
  ALTER COLUMN schedule_id SET NOT NULL;

ALTER TABLE public.availability_overrides
  ALTER COLUMN schedule_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_types_schedule_owner_fkey'
      AND conrelid = 'public.event_types'::regclass
  ) THEN
    ALTER TABLE public.event_types
      ADD CONSTRAINT event_types_schedule_owner_fkey
      FOREIGN KEY (schedule_id, user_id)
      REFERENCES public.schedules(id, user_id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'availability_rules_schedule_owner_fkey'
      AND conrelid = 'public.availability_rules'::regclass
  ) THEN
    ALTER TABLE public.availability_rules
      ADD CONSTRAINT availability_rules_schedule_owner_fkey
      FOREIGN KEY (schedule_id, user_id)
      REFERENCES public.schedules(id, user_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'availability_overrides_schedule_owner_fkey'
      AND conrelid = 'public.availability_overrides'::regclass
  ) THEN
    ALTER TABLE public.availability_overrides
      ADD CONSTRAINT availability_overrides_schedule_owner_fkey
      FOREIGN KEY (schedule_id, user_id)
      REFERENCES public.schedules(id, user_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_types_schedule_id
  ON public.event_types(schedule_id);

CREATE INDEX IF NOT EXISTS idx_availability_rules_schedule_weekday
  ON public.availability_rules(schedule_id, weekday)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_availability_overrides_schedule_date
  ON public.availability_overrides(schedule_id, date);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedules'
      AND policyname = 'Users can manage own schedules'
  ) THEN
    CREATE POLICY "Users can manage own schedules"
      ON public.schedules
      FOR ALL
      USING (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()))
      WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedules TO authenticated;
REVOKE ALL ON TABLE public.schedules FROM anon;
