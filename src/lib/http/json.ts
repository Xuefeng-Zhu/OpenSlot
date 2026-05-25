import { NextResponse } from 'next/server'

export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse }

function invalidJsonBodyResult(): JsonBodyResult {
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    ),
  }
}

/**
 * Parses a JSON request body into a stable 400 response for malformed payloads.
 * Route-level validation can then assume parsing succeeded and focus on schema
 * errors without leaking syntax failures as generic 500s.
 */
export async function parseJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    return { ok: true, body: await request.json() }
  } catch {
    return invalidJsonBodyResult()
  }
}

/**
 * Parses an optional JSON request body while treating an omitted body as an
 * empty object. Malformed non-empty payloads still receive the shared 400
 * response.
 */
export async function parseOptionalJsonBody(
  request: Request
): Promise<JsonBodyResult> {
  const rawBody = await request.text()

  if (!rawBody.trim()) {
    return { ok: true, body: {} }
  }

  try {
    return { ok: true, body: JSON.parse(rawBody) as unknown }
  } catch {
    return invalidJsonBodyResult()
  }
}
