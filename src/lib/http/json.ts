import { NextResponse } from 'next/server'

export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse }

/**
 * Parses a JSON request body into a stable 400 response for malformed payloads.
 * Route-level validation can then assume parsing succeeded and focus on schema
 * errors without leaking syntax failures as generic 500s.
 */
export async function parseJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    return { ok: true, body: await request.json() }
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      ),
    }
  }
}
