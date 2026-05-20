import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BookingAgentGatewayError,
  ButterbaseBookingAgentProvider,
} from '@/lib/backend/booking-agent-gateway'

describe('ButterbaseBookingAgentProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('calls the Butterbase model gateway with the default DeepSeek model', async () => {
    const fetchImpl = mockFetch({
      choices: [{ message: { content: '{"reply":"Hi"}' } }],
    })
    const provider = new ButterbaseBookingAgentProvider({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai/',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await provider.complete({
      messages: [{ role: 'user', content: 'Find a time' }],
    })

    expect(result).toBe('{"reply":"Hi"}')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.butterbase.ai/v1/app_openslot/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek/deepseek-v4-flash',
          messages: [{ role: 'user', content: 'Find a time' }],
          max_tokens: 700,
          temperature: 0.2,
          stream: false,
        }),
      })
    )
    expect(requestHeaders(fetchImpl).get('Authorization')).toBe(
      'Bearer service-key'
    )
  })

  it('allows a deploy-time model override', async () => {
    vi.stubEnv('BOOKING_AGENT_MODEL', 'custom/model')
    const fetchImpl = mockFetch({
      choices: [{ message: { content: '{"reply":"Hi"}' } }],
    })
    const provider = new ButterbaseBookingAgentProvider({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      fetchImpl,
    })

    await provider.complete({
      messages: [{ role: 'user', content: 'Find a time' }],
    })

    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).model).toBe(
      'custom/model'
    )
  })

  it('maps gateway rejections without falling back to another model', async () => {
    const fetchImpl = mockFetch(
      { error: { message: 'Model not allowed', code: 'model_not_allowed' } },
      { status: 403 }
    )
    const provider = new ButterbaseBookingAgentProvider({
      appId: 'app_openslot',
      apiUrl: 'https://api.butterbase.ai',
      apiKey: 'service-key',
      fetchImpl,
    })

    await expect(
      provider.complete({ messages: [{ role: 'user', content: 'Find a time' }] })
    ).rejects.toMatchObject({
      message: 'Model not allowed',
      status: 403,
      code: 'model_not_allowed',
    } satisfies Partial<BookingAgentGatewayError>)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).model).toBe(
      'deepseek/deepseek-v4-flash'
    )
  })
})

function mockFetch(body: unknown, init: ResponseInit = {}) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  })
}

function requestHeaders(fetchImpl: ReturnType<typeof mockFetch>): Headers {
  return new Headers(fetchImpl.mock.calls[0]?.[1]?.headers)
}
