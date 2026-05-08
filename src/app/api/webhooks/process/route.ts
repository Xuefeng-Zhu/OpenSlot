import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWebhookDeliveriesBatch } from '@/lib/webhooks/deliveries'

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.WEBHOOK_PROCESS_SECRET
  const authorization = request.headers.get('authorization')

  if (configuredSecret && authorization !== `Bearer ${configuredSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Webhook processor is not configured' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
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
