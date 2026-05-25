import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../route'
import { handleMicrosoftCalendarWebhook } from '@/lib/calendar/watches'

const mocks = vi.hoisted(() => ({
  adminClient: { id: 'admin-client' },
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/calendar/watches', () => ({
  handleMicrosoftCalendarWebhook: vi.fn(),
}))

describe('/api/calendar/webhooks/microsoft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(handleMicrosoftCalendarWebhook).mockResolvedValue({
      ok: true,
      status: 202,
    })
  })

  it('echoes GET validation tokens as plain text', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/calendar/webhooks/microsoft?validationToken=token-1'
      ) as any
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')
    await expect(response.text()).resolves.toBe('token-1')
  })

  it('rejects GET validation requests without a token', async () => {
    const response = await GET(
      new Request('http://localhost/api/calendar/webhooks/microsoft') as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'Missing validation token',
    })
  })

  it('echoes POST validation tokens before reading the body', async () => {
    const response = await POST(
      new Request(
        'http://localhost/api/calendar/webhooks/microsoft?validationToken=token-2',
        { method: 'POST', body: '{' }
      ) as any
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')
    await expect(response.text()).resolves.toBe('token-2')
    expect(handleMicrosoftCalendarWebhook).not.toHaveBeenCalled()
  })

  it('delegates Microsoft notifications to the watch handler', async () => {
    const body = {
      value: [
        {
          subscriptionId: 'subscription-1',
          clientState: 'client-state',
        },
      ],
    }

    const response = await POST(
      new Request('http://localhost/api/calendar/webhooks/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(202)
    expect(data).toEqual({ success: true })
    expect(handleMicrosoftCalendarWebhook).toHaveBeenCalledWith(
      mocks.adminClient,
      body
    )
  })

  it('rejects malformed notification JSON without delegating to the watch handler', async () => {
    const response = await POST(
      new Request('http://localhost/api/calendar/webhooks/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'Invalid JSON body',
    })
    expect(handleMicrosoftCalendarWebhook).not.toHaveBeenCalled()
  })
})
