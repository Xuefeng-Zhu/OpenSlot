import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient } from '@/lib/backend/server'
import { processOutboxBatch } from '@/lib/outbox/process'
import { authorizeWorkerRequest } from '@/lib/workers/auth'

/**
 * Processes queued outbox events from a worker POST body.
 * The route is secret-protected because handlers can send email, write calendar
 * events, and enqueue tenant webhook deliveries.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await safeJson(request)
  return runOutboxProcessor(request, body)
}

/**
 * Processes queued outbox events from cron/query-string parameters.
 * Provides the same worker behavior as POST for hosts that can only schedule GETs.
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const limitParam = searchParams.get('limit')
  const maxAttemptsParam = searchParams.get('maxAttempts')

  return runOutboxProcessor(request, {
    limit: limitParam ? Number(limitParam) : undefined,
    maxAttempts: maxAttemptsParam ? Number(maxAttemptsParam) : undefined,
  })
}

async function runOutboxProcessor(
  request: NextRequest,
  body: Record<string, unknown> | null
) {
  const auth = authorizeWorkerRequest(request, 'OUTBOX_PROCESS_SECRET')

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const limit = normalizeLimit(body?.limit)
  const maxAttempts = normalizeMaxAttempts(body?.maxAttempts)
  const result = await processOutboxBatch({
    adminClient: createAdminBackendClient(),
    limit,
    maxAttempts,
  })

  return NextResponse.json({ success: true, ...result })
}

async function safeJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function normalizeLimit(value: unknown): number {
  return clampInteger(value, 10, 1, 50)
}

function normalizeMaxAttempts(value: unknown): number {
  return clampInteger(value, 5, 1, 20)
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fallback
  }

  return Math.min(Math.max(value, min), max)
}
