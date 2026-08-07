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
const INPUT_FIELDS = [
  'connectionId',
  'expectedUpdatedAt',
  'accessTokenEncrypted',
  'refreshTokenEncrypted',
  'tokenExpiresAt',
  'scopes',
] as const

const REFRESH_PROVIDER_TOKEN_SQL = `
UPDATE public.provider_connections
SET
  access_token_encrypted = $3,
  refresh_token_encrypted = $4,
  token_expires_at = $5::timestamptz,
  scopes = $6::text[],
  last_error = NULL,
  updated_at = GREATEST(
    date_trunc('milliseconds', statement_timestamp()),
    date_trunc('milliseconds', updated_at) + INTERVAL '1 millisecond'
  )
WHERE id = $1::uuid
  AND date_trunc('milliseconds', updated_at) =
    date_trunc('milliseconds', $2::timestamptz)
RETURNING id
`

/**
 * Atomically stores refreshed provider credentials only when the connection
 * version still matches the version read by the refresh worker.
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
    const result = await ctx.db.query(REFRESH_PROVIDER_TOKEN_SQL, [
      body.connectionId,
      body.expectedUpdatedAt,
      body.accessTokenEncrypted,
      body.refreshTokenEncrypted,
      body.tokenExpiresAt,
      body.scopes,
    ])
    const rows = Array.isArray(result) ? result : result.rows ?? []

    return json({ updated: rows.length === 1 })
  } catch {
    console.error('Atomic provider token refresh query failed')
    return json({ success: false, error: 'Unable to store provider token' }, 500)
  }
}

function isValidInput(value: unknown): value is {
  connectionId: string
  expectedUpdatedAt: string
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  tokenExpiresAt: string | null
  scopes: string[]
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const input = value as Record<string, unknown>
  const keys = Object.keys(input)
  if (
    keys.length !== INPUT_FIELDS.length ||
    keys.some(
      (key) => !INPUT_FIELDS.includes(key as (typeof INPUT_FIELDS)[number])
    )
  ) {
    return false
  }

  return (
    typeof input.connectionId === 'string' &&
    isUuid(input.connectionId) &&
    typeof input.expectedUpdatedAt === 'string' &&
    isTimestamp(input.expectedUpdatedAt) &&
    typeof input.accessTokenEncrypted === 'string' &&
    input.accessTokenEncrypted.length > 0 &&
    typeof input.refreshTokenEncrypted === 'string' &&
    input.refreshTokenEncrypted.length > 0 &&
    (input.tokenExpiresAt === null ||
      (typeof input.tokenExpiresAt === 'string' &&
        isTimestamp(input.tokenExpiresAt))) &&
    Array.isArray(input.scopes) &&
    input.scopes.length <= 100 &&
    input.scopes.every(
      (scope) =>
        typeof scope === 'string' && scope.length > 0 && scope.length <= 500
    )
  )
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
}

function isTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime())
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
