import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWebhookDeliveriesBatch } from '@/lib/webhooks/deliveries'
import { authorizeWorkerRequest } from '@/lib/workers/auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return runWebhookProcessor(request, body)
}

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams

  return runWebhookProcessor(request, {
    limit: numberFromParam(searchParams.get('limit')),
    maxAttempts: numberFromParam(searchParams.get('maxAttempts')),
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
    adminClient: createAdminClient(),
    limit,
    maxAttempts,
  })

  return NextResponse.json({
    success: true,
    ...result,
  })
}

function numberFromParam(value: string | null): number | undefined {
  return value ? Number(value) : undefined
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
