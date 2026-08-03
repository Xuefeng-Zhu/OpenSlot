interface ButterbaseFunctionContext {
  db: {
    query(
      sql: string,
      params?: unknown[]
    ): Promise<unknown[] | { rows?: unknown[] }>
  }
  caller?: {
    type?: 'service_key' | 'end_user_jwt' | 'loopback' | 'anonymous'
  }
}

interface AvailabilityRuleInput {
  id?: string
  weekday: number
  start_time: string
  end_time: string
  is_active: boolean
}

interface AvailabilityOverrideInput {
  id?: string
  date: string
  start_time: string | null
  end_time: string | null
  is_available: boolean
  reason?: string | null
}

interface SaveAvailabilityInput {
  userId: string
  scheduleId: string
  expectedScheduleUpdatedAt: string
  timezone: string
  rules: AvailabilityRuleInput[]
  overrides: AvailabilityOverrideInput[]
  deletedRuleIds: string[]
  deletedOverrideIds: string[]
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const INPUT_FIELDS = [
  'userId',
  'scheduleId',
  'expectedScheduleUpdatedAt',
  'timezone',
  'rules',
  'overrides',
  'deletedRuleIds',
  'deletedOverrideIds',
] as const
const RULE_FIELDS = [
  'id',
  'weekday',
  'start_time',
  'end_time',
  'is_active',
] as const
const OVERRIDE_FIELDS = [
  'id',
  'date',
  'start_time',
  'end_time',
  'is_available',
  'reason',
] as const
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

const SAVE_AVAILABILITY_SQL = `
WITH rule_input AS (
  SELECT
    input.id,
    input.weekday,
    input.start_time,
    input.end_time,
    input.is_active
  FROM jsonb_to_recordset($4::jsonb) AS input(
    id uuid,
    weekday integer,
    start_time time,
    end_time time,
    is_active boolean
  )
), override_input AS (
  SELECT
    input.id,
    input.date,
    input.start_time,
    input.end_time,
    input.is_available,
    input.reason
  FROM jsonb_to_recordset($5::jsonb) AS input(
    id uuid,
    date date,
    start_time time,
    end_time time,
    is_available boolean,
    reason text
  )
), deleted_rule_input AS (
  SELECT value::uuid AS id
  FROM jsonb_array_elements_text($6::jsonb)
), deleted_override_input AS (
  SELECT value::uuid AS id
  FROM jsonb_array_elements_text($7::jsonb)
), owned_schedule AS (
  SELECT schedules.id, schedules.user_id, schedules.updated_at
  FROM public.schedules AS schedules
  WHERE schedules.id = $2::uuid
    AND schedules.user_id = $1::uuid
), mutation_guard AS (
  SELECT owned_schedule.id, owned_schedule.user_id
  FROM owned_schedule
  WHERE date_trunc('milliseconds', owned_schedule.updated_at) =
      date_trunc('milliseconds', $8::timestamptz)
    AND NOT EXISTS (
      SELECT 1
      FROM rule_input
      WHERE rule_input.id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.availability_rules AS owned_rule
          WHERE owned_rule.id = rule_input.id
            AND owned_rule.schedule_id = owned_schedule.id
            AND owned_rule.user_id = owned_schedule.user_id
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM override_input
      WHERE override_input.id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.availability_overrides AS owned_override
          WHERE owned_override.id = override_input.id
            AND owned_override.schedule_id = owned_schedule.id
            AND owned_override.user_id = owned_schedule.user_id
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM deleted_rule_input
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.availability_rules AS owned_deleted_rule
        WHERE owned_deleted_rule.id = deleted_rule_input.id
          AND owned_deleted_rule.schedule_id = owned_schedule.id
          AND owned_deleted_rule.user_id = owned_schedule.user_id
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM deleted_override_input
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.availability_overrides AS owned_deleted_override
        WHERE owned_deleted_override.id = deleted_override_input.id
          AND owned_deleted_override.schedule_id = owned_schedule.id
          AND owned_deleted_override.user_id = owned_schedule.user_id
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.availability_rules AS current_rule
      WHERE current_rule.schedule_id = owned_schedule.id
        AND current_rule.user_id = owned_schedule.user_id
        AND NOT EXISTS (
          SELECT 1
          FROM rule_input
          WHERE rule_input.id = current_rule.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM deleted_rule_input
          WHERE deleted_rule_input.id = current_rule.id
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.availability_overrides AS current_override
      WHERE current_override.schedule_id = owned_schedule.id
        AND current_override.user_id = owned_schedule.user_id
        AND NOT EXISTS (
          SELECT 1
          FROM override_input
          WHERE override_input.id = current_override.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM deleted_override_input
          WHERE deleted_override_input.id = current_override.id
        )
    )
), updated_schedule AS (
  UPDATE public.schedules AS schedules
  SET
    timezone = $3,
    -- Butterbase REST timestamps are millisecond-precision. Keep the version
    -- monotonic at that same precision so browser-loaded versions compare
    -- exactly and every successful writer still advances the guard.
    updated_at = GREATEST(
      date_trunc('milliseconds', clock_timestamp()),
      date_trunc('milliseconds', schedules.updated_at) + interval '1 millisecond'
    )
  FROM mutation_guard
  WHERE schedules.id = mutation_guard.id
    AND schedules.user_id = mutation_guard.user_id
    AND date_trunc('milliseconds', schedules.updated_at) =
      date_trunc('milliseconds', $8::timestamptz)
  RETURNING
    schedules.id,
    schedules.user_id,
    schedules.timezone,
    schedules.updated_at
), deleted_rules AS (
  DELETE FROM public.availability_rules AS rules
  USING updated_schedule, deleted_rule_input
  WHERE rules.id = deleted_rule_input.id
    AND rules.schedule_id = updated_schedule.id
    AND rules.user_id = updated_schedule.user_id
  RETURNING rules.id
), deleted_overrides AS (
  DELETE FROM public.availability_overrides AS overrides
  USING updated_schedule, deleted_override_input
  WHERE overrides.id = deleted_override_input.id
    AND overrides.schedule_id = updated_schedule.id
    AND overrides.user_id = updated_schedule.user_id
  RETURNING overrides.id
), saved_rules AS (
  INSERT INTO public.availability_rules AS target (
    id,
    user_id,
    schedule_id,
    weekday,
    start_time,
    end_time,
    timezone,
    is_active,
    updated_at
  )
  SELECT
    COALESCE(rule_input.id, gen_random_uuid()),
    updated_schedule.user_id,
    updated_schedule.id,
    rule_input.weekday,
    rule_input.start_time,
    rule_input.end_time,
    updated_schedule.timezone,
    rule_input.is_active,
    statement_timestamp()
  FROM rule_input
  CROSS JOIN updated_schedule
  ON CONFLICT (id) DO UPDATE
  SET
    weekday = EXCLUDED.weekday,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    timezone = EXCLUDED.timezone,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at
  WHERE target.schedule_id = EXCLUDED.schedule_id
    AND target.user_id = EXCLUDED.user_id
  RETURNING
    target.id,
    target.weekday,
    target.start_time,
    target.end_time,
    target.is_active
), saved_overrides AS (
  INSERT INTO public.availability_overrides AS target (
    id,
    user_id,
    schedule_id,
    date,
    start_time,
    end_time,
    timezone,
    is_available,
    reason,
    updated_at
  )
  SELECT
    COALESCE(override_input.id, gen_random_uuid()),
    updated_schedule.user_id,
    updated_schedule.id,
    override_input.date,
    override_input.start_time,
    override_input.end_time,
    updated_schedule.timezone,
    override_input.is_available,
    override_input.reason,
    statement_timestamp()
  FROM override_input
  CROSS JOIN updated_schedule
  ON CONFLICT (id) DO UPDATE
  SET
    date = EXCLUDED.date,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    timezone = EXCLUDED.timezone,
    is_available = EXCLUDED.is_available,
    reason = EXCLUDED.reason,
    updated_at = EXCLUDED.updated_at
  WHERE target.schedule_id = EXCLUDED.schedule_id
    AND target.user_id = EXCLUDED.user_id
  RETURNING
    target.id,
    target.date,
    target.start_time,
    target.end_time,
    target.is_available,
    target.reason
)
SELECT
  EXISTS (SELECT 1 FROM owned_schedule) AS schedule_owned,
  EXISTS (SELECT 1 FROM mutation_guard) AS mutation_allowed,
  EXISTS (SELECT 1 FROM updated_schedule) AS save_applied,
  (SELECT updated_at FROM updated_schedule) AS schedule_updated_at,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', saved_rules.id,
          'weekday', saved_rules.weekday,
          'start_time', saved_rules.start_time,
          'end_time', saved_rules.end_time,
          'is_active', saved_rules.is_active
        )
        ORDER BY saved_rules.weekday, saved_rules.start_time, saved_rules.id
      )
      FROM saved_rules
    ),
    '[]'::jsonb
  ) AS rules,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', saved_overrides.id,
          'date', saved_overrides.date,
          'start_time', saved_overrides.start_time,
          'end_time', saved_overrides.end_time,
          'is_available', saved_overrides.is_available,
          'reason', saved_overrides.reason
        )
        ORDER BY saved_overrides.date, saved_overrides.start_time, saved_overrides.id
      )
      FROM saved_overrides
    ),
    '[]'::jsonb
  ) AS overrides,
  (SELECT count(*) FROM deleted_rules) AS deleted_rule_count,
  (SELECT count(*) FROM deleted_overrides) AS deleted_override_count
`

/**
 * Saves one host-owned availability schedule through a single parameterized
 * Postgres statement. Ownership and stale-row checks gate every mutation, so
 * a caller cannot update another host's schedule, rules, or overrides.
 */
export default async function handler(
  req: Request,
  ctx: ButterbaseFunctionContext
): Promise<Response> {
  if (ctx.caller?.type !== 'service_key') {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  if (req.method !== 'POST') {
    return json(
      { success: false, error: 'Method not allowed' },
      405,
      { Allow: 'POST' }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'Invalid request' }, 400)
  }

  if (!isValidInput(body)) {
    return json({ success: false, error: 'Invalid request' }, 400)
  }

  try {
    const result = await ctx.db.query(SAVE_AVAILABILITY_SQL, [
      body.userId,
      body.scheduleId,
      body.timezone,
      JSON.stringify(body.rules),
      JSON.stringify(body.overrides),
      JSON.stringify(body.deletedRuleIds),
      JSON.stringify(body.deletedOverrideIds),
      body.expectedScheduleUpdatedAt,
    ])
    const rows = Array.isArray(result) ? result : result.rows ?? []
    const row = rows[0] as Record<string, unknown> | undefined

    if (!row || !readBoolean(row, 'schedule_owned', 'scheduleOwned')) {
      return json({ success: false, error: 'Schedule not found' }, 404)
    }

    if (!readBoolean(row, 'mutation_allowed', 'mutationAllowed')) {
      return json(
        {
          success: false,
          error: 'Availability changed; reload and retry',
        },
        409
      )
    }

    if (!readBoolean(row, 'save_applied', 'saveApplied')) {
      return json(
        {
          success: false,
          error: 'Availability changed; reload and retry',
        },
        409
      )
    }

    const scheduleUpdatedAt = readTimestamp(
      row,
      'schedule_updated_at',
      'scheduleUpdatedAt'
    )
    if (!scheduleUpdatedAt) {
      console.error('Atomic availability query omitted the schedule version')
      return json({ success: false, error: 'Unable to save availability' }, 500)
    }

    return json({
      rules: readJsonArray(row.rules),
      overrides: readJsonArray(row.overrides),
      scheduleUpdatedAt,
    })
  } catch {
    console.error('Atomic availability query failed')
    return json({ success: false, error: 'Unable to save availability' }, 500)
  }
}

function isValidInput(value: unknown): value is SaveAvailabilityInput {
  if (!isRecord(value) || !hasExactKeys(value, INPUT_FIELDS)) return false

  const rules = value.rules
  const overrides = value.overrides
  const deletedRuleIds = value.deletedRuleIds
  const deletedOverrideIds = value.deletedOverrideIds

  if (
    typeof value.userId !== 'string' ||
    !isUuid(value.userId) ||
    typeof value.scheduleId !== 'string' ||
    !isUuid(value.scheduleId) ||
    typeof value.expectedScheduleUpdatedAt !== 'string' ||
    !isTimestamp(value.expectedScheduleUpdatedAt) ||
    typeof value.timezone !== 'string' ||
    !isTimezone(value.timezone) ||
    !Array.isArray(rules) ||
    !Array.isArray(overrides) ||
    !isUuidArray(deletedRuleIds) ||
    !isUuidArray(deletedOverrideIds)
  ) {
    return false
  }

  if (!rules.every(isValidRule) || !overrides.every(isValidOverride)) {
    return false
  }

  const ruleIds = rules.flatMap((rule) => (rule.id ? [rule.id] : []))
  const overrideIds = overrides.flatMap((override) =>
    override.id ? [override.id] : []
  )

  return (
    hasUniqueValues(ruleIds) &&
    hasUniqueValues(overrideIds) &&
    !ruleIds.some((id) => deletedRuleIds.includes(id)) &&
    !overrideIds.some((id) => deletedOverrideIds.includes(id))
  )
}

function isValidRule(value: unknown): value is AvailabilityRuleInput {
  if (!isRecord(value) || !hasExactKeys(value, RULE_FIELDS)) return false

  return (
    (!('id' in value) ||
      (typeof value.id === 'string' && isUuid(value.id))) &&
    typeof value.weekday === 'number' &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6 &&
    typeof value.start_time === 'string' &&
    typeof value.end_time === 'string' &&
    isPositiveTimeRange(value.start_time, value.end_time) &&
    typeof value.is_active === 'boolean'
  )
}

function isValidOverride(value: unknown): value is AvailabilityOverrideInput {
  if (!isRecord(value) || !hasExactKeys(value, OVERRIDE_FIELDS)) return false

  if (
    ('id' in value &&
      (typeof value.id !== 'string' || !isUuid(value.id))) ||
    typeof value.date !== 'string' ||
    !isDateOnly(value.date) ||
    !isNullableTime(value.start_time) ||
    !isNullableTime(value.end_time) ||
    typeof value.is_available !== 'boolean' ||
    ('reason' in value &&
      value.reason !== null &&
      (typeof value.reason !== 'string' || value.reason.length > 500))
  ) {
    return false
  }

  if (!value.is_available) return true

  return (
    typeof value.start_time === 'string' &&
    typeof value.end_time === 'string' &&
    isPositiveTimeRange(value.start_time, value.end_time)
  )
}

function hasExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean {
  const keys = Object.keys(value)
  const required = allowed.filter((key) => key !== 'id' && key !== 'reason')
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => allowed.includes(key))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isUuidArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && isUuid(item)) &&
    hasUniqueValues(value)
  )
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
}

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

function isTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

function isNullableTime(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && TIME_PATTERN.test(value))
}

function isPositiveTimeRange(startTime: string, endTime: string): boolean {
  return (
    TIME_PATTERN.test(startTime) &&
    TIME_PATTERN.test(endTime) &&
    timeToSeconds(startTime) < timeToSeconds(endTime)
  )
}

function timeToSeconds(value: string): number {
  const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function readBoolean(
  row: Record<string, unknown>,
  snakeCase: string,
  camelCase: string
): boolean {
  return row[snakeCase] === true || row[camelCase] === true
}

function readTimestamp(
  row: Record<string, unknown>,
  snakeCase: string,
  camelCase: string
): string | null {
  const value = row[snakeCase] ?? row[camelCase]
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString()
  }
  return typeof value === 'string' && isTimestamp(value) ? value : null
}

function readJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  })
}
