import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../route'
import { syncActiveCalendarConnections } from '@/lib/calendar/provider-sync'
import { maintainCalendarWatches } from '@/lib/calendar/watches'

const mocks = vi.hoisted(() => ({
  adminClient: { id: 'admin-client' },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/calendar/provider-sync', () => ({
  syncActiveCalendarConnections: vi.fn(),
}))

vi.mock('@/lib/calendar/watches', () => ({
  maintainCalendarWatches: vi.fn(),
}))

describe('/api/calendar/sync', () => {
  const originalCalendarSecret = process.env.CALENDAR_SYNC_SECRET
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CALENDAR_SYNC_SECRET = 'calendar-secret'
    process.env.CRON_SECRET = undefined
    vi.mocked(syncActiveCalendarConnections).mockResolvedValue({
      checked: 2,
      synced: 2,
      failed: 0,
    })
    vi.mocked(maintainCalendarWatches).mockResolvedValue({
      checked: 3,
      ensured: 2,
      skipped: 1,
      failed: 0,
    })
  })

  afterEach(() => {
    process.env.CALENDAR_SYNC_SECRET = originalCalendarSecret
    process.env.CRON_SECRET = originalCronSecret
  })

  it('requires a worker bearer token', async () => {
    const response = await POST(
      new Request('http://localhost/api/calendar/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any
    )

    expect(response.status).toBe(401)
  })

  it('runs sync with POST body options', async () => {
    const response = await POST(
      new Request('http://localhost/api/calendar/sync', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer calendar-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 7 }),
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      checked: 2,
      synced: 2,
      failed: 0,
      watches: {
        checked: 3,
        ensured: 2,
        skipped: 1,
        failed: 0,
      },
    })
    expect(syncActiveCalendarConnections).toHaveBeenCalledWith(
      mocks.adminClient,
      7
    )
    expect(maintainCalendarWatches).toHaveBeenCalledWith(mocks.adminClient, 7)
  })

  it('accepts Vercel cron GET requests authenticated by CRON_SECRET', async () => {
    process.env.CALENDAR_SYNC_SECRET = undefined
    process.env.CRON_SECRET = 'cron-secret'

    const response = await GET(
      new Request('http://localhost/api/calendar/sync?limit=4', {
        headers: { Authorization: 'Bearer cron-secret' },
      }) as any
    )

    expect(response.status).toBe(200)
    expect(syncActiveCalendarConnections).toHaveBeenCalledWith(
      mocks.adminClient,
      4
    )
    expect(maintainCalendarWatches).toHaveBeenCalledWith(mocks.adminClient, 4)
  })
})
