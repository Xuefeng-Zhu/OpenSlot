import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient } from '@/lib/backend/server'
import { processWebhookDeliveriesBatch } from '@/lib/webhooks/deliveries'
import { authorizeWorkerRequest } from '@/lib/workers/auth'
import {
  numberFromSearchParam,
  readWorkerJsonObject,
} from '@/lib/workers/request-options'

/**
 * Processes webhook deliveries from a worker POST body.
 * Auth accepts WEBHOOK_PROCESS_SECRET or CRON_SECRET before claiming delivery rows.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const body = await readWorkerJsonObject(request)
  return runWebhookProcessor(request, body)
}

/**
 * Processes webhook deliveries from cron/query-string parameters.
 * This mirrors POST so scheduled jobs can trigger delivery retries without a body.
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams

  return runWebhookProcessor(request, {
    limit: numberFromSearchParam(searchParams.get('limit')),
    maxAttempts: numberFromSearchParam(searchParams.get('maxAttempts')),
  })
}

async function runWebhookProcessor(
  request: NextRequest,
  body: Record<string, unknown>
) {
  const auth = authorizeWorkerRequest(request, 'WEBHOOK_PROCESS_SECRET')

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    )
  }

  const limit = normalizeInteger(body?.limit, 10, 1, 50)
  const maxAttempts = normalizeInteger(body?.maxAttempts, 5, 1, 20)

  const result = await processWebhookDeliveriesBatch({
    adminClient: createAdminBackendClient(),
    limit,
    maxAttempts,
  })

  return NextResponse.json({
    success: true,
    ...result,
  })
}

function normalizeInteger(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultValue
  }

  return Math.min(Math.max(Math.trunc(value), min), max)
}
