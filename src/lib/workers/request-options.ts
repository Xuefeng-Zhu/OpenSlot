import type { NextRequest } from 'next/server'

/**
 * Reads an optional worker JSON body. Malformed, primitive, and array bodies are
 * treated the same as an omitted body so worker routes can keep default options.
 */
export async function readWorkerJsonObject(
  request: NextRequest
): Promise<Record<string, unknown>> {
  const parsed = await request.json().catch(() => null)

  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

export function numberFromSearchParam(value: string | null): number | undefined {
  return value ? Number(value) : undefined
}
