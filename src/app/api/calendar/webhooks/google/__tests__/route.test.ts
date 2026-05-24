import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
import { handleGoogleCalendarWebhook } from '@/lib/calendar/watches'

const mocks = vi.hoisted(() => ({
  adminClient: { id: 'admin-client' },
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/calendar/watches', () => ({
  handleGoogleCalendarWebhook: vi.fn(),
}))

describe('POST /api/calendar/webhooks/google', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(handleGoogleCalendarWebhook).mockResolvedValue({
      ok: true,
      status: 204,
    })
  })

  it('delegates Google notification headers to the watch handler', async () => {
    const request = new Request('http://localhost/api/calendar/webhooks/google', {
      method: 'POST',
      headers: {
        'x-goog-channel-id': 'channel-1',
        'x-goog-resource-id': 'resource-1',
      },
    })

    const response = await POST(request as any)

    expect(response.status).toBe(204)
    expect(handleGoogleCalendarWebhook).toHaveBeenCalledWith(
      mocks.adminClient,
      request.headers
    )
  })

  it('returns handler failures as JSON', async () => {
    vi.mocked(handleGoogleCalendarWebhook).mockResolvedValue({
      ok: false,
      status: 404,
      error: 'Watch not found',
    })

    const response = await POST(
      new Request('http://localhost/api/calendar/webhooks/google', {
        method: 'POST',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({ success: false, error: 'Watch not found' })
  })
})
