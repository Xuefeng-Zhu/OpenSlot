import { NextRequest, NextResponse } from 'next/server'
import { expireStaleSlotHolds } from '@/lib/booking/hold-expiry'
import { createAdminBackendClient } from '@/lib/backend/server'
import { authorizeWorkerRequest } from '@/lib/workers/auth'
import {
  numberFromSearchParam,
  readWorkerJsonObject,
} from '@/lib/workers/request-options'

/**
 * Expires stale slot holds from a worker POST body.
 * The route is secret-protected because it mutates booking availability state.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await readWorkerJsonObject(request)
  return runHoldExpiry(request, {
    limit: normalizeLimit(body.limit),
  })
}

/**
 * Expires stale slot holds from cron/query-string parameters.
 * Provides the same behavior as POST for schedulers that can only call GET.
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  return runHoldExpiry(request, {
    limit: normalizeLimit(numberFromSearchParam(searchParams.get('limit'))),
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
    adminClient: createAdminBackendClient(),
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
