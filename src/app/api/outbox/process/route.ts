import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient } from '@/lib/backend/server'
import { processOutboxBatch } from '@/lib/outbox/process'
import { authorizeWorkerRequest } from '@/lib/workers/auth'
import {
  numberFromSearchParam,
  readWorkerJsonObject,
} from '@/lib/workers/request-options'

/**
 * Processes queued outbox events from a worker POST body.
 * The route is secret-protected because handlers can send email, write calendar
 * events, and enqueue tenant webhook deliveries.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await readWorkerJsonObject(request)
  return runOutboxProcessor(request, body)
}

/**
 * Processes queued outbox events from cron/query-string parameters.
 * Provides the same worker behavior as POST for hosts that can only schedule GETs.
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams

  return runOutboxProcessor(request, {
    limit: numberFromSearchParam(searchParams.get('limit')),
    maxAttempts: numberFromSearchParam(searchParams.get('maxAttempts')),
  })
}

async function runOutboxProcessor(
  request: NextRequest,
  body: Record<string, unknown>
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
