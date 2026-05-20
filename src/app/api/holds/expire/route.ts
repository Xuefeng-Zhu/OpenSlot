import { NextRequest, NextResponse } from 'next/server'
import { expireStaleSlotHolds } from '@/lib/booking/hold-expiry'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeWorkerRequest } from '@/lib/workers/auth'

/**
 * Expires stale slot holds from a worker POST body.
 * The route is secret-protected because it mutates booking availability state.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return runHoldExpiry(request, {
    limit: normalizeLimit((body as { limit?: unknown }).limit),
  })
}

/**
 * Expires stale slot holds from cron/query-string parameters.
 * Provides the same behavior as POST for schedulers that can only call GET.
 */
export async function GET(request: NextRequest) {
  const limit = new URL(request.url).searchParams.get('limit')
  return runHoldExpiry(request, {
    limit: normalizeLimit(limit ? Number(limit) : undefined),
  })
}

async function runHoldExpiry(
  request: NextRequest,
  options: { limit: number }
) {
  const auth = authorizeWorkerRequest(request, 'HOLD_EXPIRY_PROCESS_SECRET')

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const result = await expireStaleSlotHolds({
    adminClient: createAdminClient(),
    limit: options.limit,
  })

  return NextResponse.json({ success: true, ...result })
}

function normalizeLimit(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return 500
  }

  return Math.min(Math.max(Math.floor(numeric), 1), 1000)
}
