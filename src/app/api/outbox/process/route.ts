import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processOutboxBatch } from '@/lib/outbox/process'

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.OUTBOX_PROCESS_SECRET
  const authorization = request.headers.get('authorization')

  if (configuredSecret) {
    if (authorization !== `Bearer ${configuredSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Outbox processor is not configured' },
      { status: 503 }
    )
  }

  const body = await safeJson(request)
  const limit = normalizeLimit(body?.limit)
  const maxAttempts = normalizeMaxAttempts(body?.maxAttempts)
  const result = await processOutboxBatch({
    adminClient: createAdminClient(),
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
