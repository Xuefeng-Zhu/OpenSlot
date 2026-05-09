import { NextRequest, NextResponse } from 'next/server'
import { syncActiveCalendarConnections } from '@/lib/calendar/provider-sync'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeWorkerRequest } from '@/lib/workers/auth'

/**
 * Runs calendar connection sync from a worker POST body.
 * Sync refreshes tokens, calendar metadata, and external busy-cache rows used by
 * public slot calculations.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return runCalendarSync(request, {
    limit: normalizeLimit((body as { limit?: unknown }).limit),
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

  const result = await syncActiveCalendarConnections(
    createAdminClient(),
    options.limit
  )

  return NextResponse.json({ success: true, ...result })
}

function normalizeLimit(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return undefined
  }

  return Math.min(Math.max(Math.floor(numeric), 1), 100)
}
