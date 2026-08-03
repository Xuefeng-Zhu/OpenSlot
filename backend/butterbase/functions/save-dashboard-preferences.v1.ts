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

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const
const TIME_FORMATS = ['12h', '24h'] as const
const INPUT_FIELDS = [
  'profileId',
  'defaultTimezone',
  'dateFormat',
  'timeFormat',
] as const

const SAVE_PREFERENCES_SQL = `
WITH updated_profile AS (
  UPDATE public.profiles
  SET
    default_timezone = $2,
    updated_at = statement_timestamp()
  WHERE id = $1::uuid
  RETURNING id, default_timezone
), saved_settings AS (
  INSERT INTO public.user_settings (
    profile_id,
    date_format,
    time_format,
    updated_at
  )
  SELECT
    id,
    $3,
    $4,
    statement_timestamp()
  FROM updated_profile
  ON CONFLICT (profile_id) DO UPDATE
  SET
    date_format = EXCLUDED.date_format,
    time_format = EXCLUDED.time_format,
    updated_at = EXCLUDED.updated_at
  RETURNING profile_id, date_format, time_format
)
SELECT
  updated_profile.id AS profile_id,
  updated_profile.default_timezone,
  saved_settings.date_format,
  saved_settings.time_format
FROM updated_profile
INNER JOIN saved_settings
  ON saved_settings.profile_id = updated_profile.id
`

/**
 * Atomically saves a host timezone and display formats in one parameterized
 * Postgres statement. If either write fails, Postgres rolls back the complete
 * data-modifying CTE before the function returns an error.
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
    const result = await ctx.db.query(SAVE_PREFERENCES_SQL, [
      body.profileId,
      body.defaultTimezone,
      body.dateFormat,
      body.timeFormat,
    ])
    const rows = Array.isArray(result) ? result : result.rows ?? []

    if (rows.length !== 1) {
      return json({ success: false, error: 'Profile not found' }, 404)
    }

    return json({ success: true })
  } catch {
    console.error('Atomic dashboard preference query failed')
    return json({ success: false, error: 'Unable to save preferences' }, 500)
  }
}

function isValidInput(value: unknown): value is {
  profileId: string
  defaultTimezone: string
  dateFormat: (typeof DATE_FORMATS)[number]
  timeFormat: (typeof TIME_FORMATS)[number]
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const input = value as Record<string, unknown>
  const keys = Object.keys(input)
  if (
    keys.length !== INPUT_FIELDS.length ||
    keys.some((key) => !INPUT_FIELDS.includes(key as (typeof INPUT_FIELDS)[number]))
  ) {
    return false
  }

  return (
    typeof input.profileId === 'string' &&
    isUuid(input.profileId) &&
    typeof input.defaultTimezone === 'string' &&
    isTimezone(input.defaultTimezone) &&
    typeof input.dateFormat === 'string' &&
    DATE_FORMATS.includes(input.dateFormat as (typeof DATE_FORMATS)[number]) &&
    typeof input.timeFormat === 'string' &&
    TIME_FORMATS.includes(input.timeFormat as (typeof TIME_FORMATS)[number])
  )
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
