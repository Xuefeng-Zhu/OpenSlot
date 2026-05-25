import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeWorkerRequest } from '../auth'

describe('authorizeWorkerRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows local worker requests when no worker secret is configured', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('OUTBOX_PROCESS_SECRET', '')

    expect(
      authorizeWorkerRequest(request(), 'OUTBOX_PROCESS_SECRET')
    ).toEqual({ ok: true })
  })

  it('fails closed in production when no worker secret is configured', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('OUTBOX_PROCESS_SECRET', '')

    expect(
      authorizeWorkerRequest(request(), 'OUTBOX_PROCESS_SECRET')
    ).toEqual({
      ok: false,
      status: 503,
      error: 'Worker secret is not configured',
    })
  })

  it('accepts either the worker-specific secret or CRON_SECRET', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('OUTBOX_PROCESS_SECRET', 'outbox-secret')
    vi.stubEnv('CRON_SECRET', 'cron-secret')

    expect(
      authorizeWorkerRequest(
        request('Bearer outbox-secret'),
        'OUTBOX_PROCESS_SECRET'
      )
    ).toEqual({ ok: true })
    expect(
      authorizeWorkerRequest(
        request('Bearer cron-secret'),
        'OUTBOX_PROCESS_SECRET'
      )
    ).toEqual({ ok: true })
  })

  it('rejects mismatched bearer tokens when a secret is configured', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('OUTBOX_PROCESS_SECRET', 'outbox-secret')
    vi.stubEnv('CRON_SECRET', '')

    expect(
      authorizeWorkerRequest(
        request('Bearer wrong-secret'),
        'OUTBOX_PROCESS_SECRET'
      )
    ).toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })
  })
})

function request(authorization?: string): any {
  return new Request('http://localhost/api/outbox/process', {
    headers: authorization ? { authorization } : {},
  })
}
