import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {},
  processOutboxBatch: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/outbox/process', () => ({
  processOutboxBatch: mocks.processOutboxBatch,
}))

function request({
  body = { limit: 4, maxAttempts: 6 },
  authorization,
}: {
  body?: unknown
  authorization?: string
} = {}) {
  return new Request('http://localhost/api/outbox/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/outbox/process', () => {
  const originalSecret = process.env.OUTBOX_PROCESS_SECRET
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OUTBOX_PROCESS_SECRET = 'secret'
    process.env.CRON_SECRET = undefined
    mocks.processOutboxBatch.mockResolvedValue({
      claimed: 2,
      completed: 2,
      failed: 0,
    })
  })

  afterEach(() => {
    process.env.OUTBOX_PROCESS_SECRET = originalSecret
    process.env.CRON_SECRET = originalCronSecret
  })

  it('rejects requests without the configured bearer token', async () => {
    const response = await POST(request() as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
    expect(mocks.processOutboxBatch).not.toHaveBeenCalled()
  })

  it('processes a batch with a valid bearer token', async () => {
    const response = await POST(
      request({ authorization: 'Bearer secret' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      claimed: 2,
      completed: 2,
      failed: 0,
    })
    expect(mocks.processOutboxBatch).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      limit: 4,
      maxAttempts: 6,
    })
  })

  it('clamps unsupported limits to defaults', async () => {
    const response = await POST(
      request({
        authorization: 'Bearer secret',
        body: { limit: 500, maxAttempts: 'bad' },
      }) as any
    )

    expect(response.status).toBe(200)
    expect(mocks.processOutboxBatch).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      limit: 50,
      maxAttempts: 5,
    })
  })

  it('accepts Vercel cron GET requests authenticated by CRON_SECRET', async () => {
    process.env.OUTBOX_PROCESS_SECRET = undefined
    process.env.CRON_SECRET = 'cron-secret'

    const response = await GET(
      new Request(
        'http://localhost/api/outbox/process?limit=7&maxAttempts=4',
        {
          headers: { Authorization: 'Bearer cron-secret' },
        }
      ) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      claimed: 2,
      completed: 2,
      failed: 0,
    })
    expect(mocks.processOutboxBatch).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      limit: 7,
      maxAttempts: 4,
    })
  })
})
