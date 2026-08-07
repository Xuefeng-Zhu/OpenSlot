import { describe, expect, it, vi } from 'vitest'
import handler from '../refresh-provider-token.v1'

const validBody = {
  connectionId: '11111111-2222-4333-8444-555555555555',
  expectedUpdatedAt: '2026-08-03T17:00:00.000Z',
  accessTokenEncrypted: 'encrypted-access',
  refreshTokenEncrypted: 'encrypted-refresh',
  tokenExpiresAt: '2026-08-03T18:00:00.000Z',
  scopes: ['calendar.read'],
}

describe('refresh-provider-token Butterbase function', () => {
  it('compares the version and updates credentials in one SQL statement', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: validBody.connectionId }] })

    const response = await handler(request(validBody), context(query))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ updated: true })
    expect(query).toHaveBeenCalledTimes(1)

    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('UPDATE public.provider_connections')
    expect(sql).toContain("date_trunc('milliseconds', statement_timestamp())")
    expect(sql).toContain("date_trunc('milliseconds', updated_at)")
    expect(sql).toContain("date_trunc('milliseconds', $2::timestamptz)")
    expect(sql).toContain('RETURNING id')
    expect(sql).not.toMatch(/\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/i)
    expect(params).toEqual([
      validBody.connectionId,
      validBody.expectedUpdatedAt,
      validBody.accessTokenEncrypted,
      validBody.refreshTokenEncrypted,
      validBody.tokenExpiresAt,
      validBody.scopes,
    ])
  })

  it('reports a lost comparison without overwriting credentials', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })

    const response = await handler(request(validBody), context(query))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ updated: false })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid input and non-service callers before querying', async () => {
    const query = vi.fn()

    const invalidResponse = await handler(
      request({ ...validBody, accessTokenEncrypted: '' }),
      context(query)
    )
    const unauthorizedResponse = await handler(
      request(validBody),
      context(query, 'end_user_jwt')
    )

    expect(invalidResponse.status).toBe(400)
    expect(unauthorizedResponse.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })
})

function request(body: unknown): Request {
  return new Request('https://api.butterbase.ai/refresh-provider-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function context(
  query: ReturnType<typeof vi.fn>,
  callerType: NonNullable<Parameters<typeof handler>[1]['caller']>['type'] =
    'service_key'
): Parameters<typeof handler>[1] {
  const runQuery = query as unknown as (
    sql: string,
    params?: unknown[]
  ) => Promise<unknown[] | { rows?: unknown[] }>

  return {
    db: { query: runQuery },
    caller: { type: callerType },
  }
}
