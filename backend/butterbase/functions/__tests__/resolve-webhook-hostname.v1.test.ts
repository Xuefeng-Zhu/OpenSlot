import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../resolve-webhook-hostname.v1'

describe('resolve-webhook-hostname Butterbase function', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns every IPv4 and IPv6 answer from the runtime resolver', async () => {
    const resolveDns = vi
      .fn()
      .mockResolvedValueOnce(['203.0.113.20'])
      .mockResolvedValueOnce(['2001:db8::20'])
    vi.stubGlobal('Deno', { resolveDns })

    const response = await handler(
      request({ hostname: 'Hooks.Example.com.' }),
      serviceContext()
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      addresses: ['203.0.113.20', '2001:db8::20'],
    })
    expect(resolveDns).toHaveBeenNthCalledWith(1, 'hooks.example.com', 'A')
    expect(resolveDns).toHaveBeenNthCalledWith(2, 'hooks.example.com', 'AAAA')
  })

  it('fails closed when DNS resolution is unavailable', async () => {
    vi.stubGlobal('Deno', {
      resolveDns: vi.fn().mockRejectedValue(new Error('resolver unavailable')),
    })

    const response = await handler(
      request({ hostname: 'hooks.example.com' }),
      serviceContext()
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      error: 'DNS resolution failed',
    })
  })

  it('rejects invalid input and non-service callers before resolution', async () => {
    const resolveDns = vi.fn()
    vi.stubGlobal('Deno', { resolveDns })

    const invalidResponse = await handler(
      request({ hostname: 'localhost', extra: true }),
      serviceContext()
    )
    const unauthorizedResponse = await handler(
      request({ hostname: 'hooks.example.com' }),
      { caller: { type: 'end_user_jwt' } }
    )

    expect(invalidResponse.status).toBe(400)
    expect(unauthorizedResponse.status).toBe(401)
    expect(resolveDns).not.toHaveBeenCalled()
  })
})

function request(body: unknown): Request {
  return new Request('https://api.butterbase.ai/resolve-webhook-hostname', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function serviceContext(): Parameters<typeof handler>[1] {
  return { caller: { type: 'service_key' } }
}
