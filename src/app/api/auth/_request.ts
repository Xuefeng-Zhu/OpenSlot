import type { NextRequest } from 'next/server'

/**
 * Reads optional auth route JSON bodies. Invalid JSON and non-object payloads
 * become null so each route can keep its existing field-specific validation.
 */
export async function readAuthJsonObject(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  const parsed = await request.json().catch(() => null)

  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null
}
