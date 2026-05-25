import { NextRequest, NextResponse } from 'next/server'
import { syncActiveCalendarConnections } from '@/lib/calendar/provider-sync'
import { maintainCalendarWatches } from '@/lib/calendar/watches'
import { createAdminBackendClient } from '@/lib/backend/server'
import { authorizeWorkerRequest } from '@/lib/workers/auth'
import { parseOptionalJsonBody } from '@/lib/http/json'

/**
 * Runs calendar connection sync from a worker POST body.
 * Sync refreshes tokens, calendar metadata, and external busy-cache rows used by
 * public slot calculations.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const json = await parseOptionalJsonBody(request)
  if (!json.ok) return json.response

  return runCalendarSync(request, {
    limit: normalizeLimit((json.body as { limit?: unknown }).limit),
  })
}

/**
 * Runs calendar connection sync from cron/query-string parameters.
 * The shared runner enforces CALENDAR_SYNC_SECRET or CRON_SECRET before syncing.
 */
export async function GET(request: NextRequest) {
  const limit = new URL(request.url).searchParams.get('limit')
  return runCalendarSync(request, {
    limit: normalizeLimit(limit ? Number(limit) : undefined),
  })
}

async function runCalendarSync(
  request: NextRequest,
  options: { limit?: number }
) {
  const auth = authorizeWorkerRequest(request, 'CALENDAR_SYNC_SECRET')

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const adminClient = createAdminBackendClient()
  const result = await syncActiveCalendarConnections(adminClient, options.limit)
  const watches = await maintainCalendarWatches(adminClient, options.limit)

  return NextResponse.json({ success: true, ...result, watches })
}

function normalizeLimit(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return undefined
  }

  return Math.min(Math.max(Math.floor(numeric), 1), 100)
}
