import { describe, expect, it, vi } from 'vitest'
import handler from '../save-dashboard-preferences.v1'

const validBody = {
  profileId: '11111111-2222-4333-8444-555555555555',
  defaultTimezone: 'America/Los_Angeles',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
}

describe('save-dashboard-preferences Butterbase function', () => {
  it('updates both preference owners with one parameterized SQL statement', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          profile_id: validBody.profileId,
          default_timezone: validBody.defaultTimezone,
          date_format: validBody.dateFormat,
          time_format: validBody.timeFormat,
        },
      ],
    })

    const response = await handler(request(validBody), context(query))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(query).toHaveBeenCalledTimes(1)

    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('WITH updated_profile AS')
    expect(sql).toContain('UPDATE public.profiles')
    expect(sql).toContain('INSERT INTO public.user_settings')
    expect(sql).toContain('ON CONFLICT (profile_id) DO UPDATE')
    expect(sql).not.toMatch(/\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/i)
    expect(params).toEqual([
      validBody.profileId,
      validBody.defaultTimezone,
      validBody.dateFormat,
      validBody.timeFormat,
    ])
  })

  it('rejects extra or invalid fields before querying the database', async () => {
    const query = vi.fn()

    const response = await handler(
      request({ ...validBody, notifyReminder: true }),
      context(query)
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid request',
    })
    expect(query).not.toHaveBeenCalled()
  })

  it('does not expose database details when the atomic statement fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = vi
      .fn()
      .mockRejectedValue(new Error('private relation and constraint details'))

    const response = await handler(request(validBody), context(query))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      error: 'Unable to save preferences',
    })
    expect(JSON.stringify(data)).not.toContain('private relation')
    expect(query).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  it.each(['anonymous', 'end_user_jwt', 'loopback'] as const)(
    'rejects a %s caller before querying the database',
    async (callerType) => {
      const query = vi.fn()
      const response = await handler(
        request(validBody),
        context(query, callerType)
      )

      expect(response.status).toBe(401)
      expect(query).not.toHaveBeenCalled()
    }
  )

  it('fails closed when Butterbase does not provide caller identity', async () => {
    const query = vi.fn()
    const response = await handler(request(validBody), {
      db: {
        query: query as Parameters<typeof handler>[1]['db']['query'],
      },
    })

    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })
})

function request(body: unknown): Request {
  return new Request('https://api.butterbase.ai/save-dashboard-preferences', {
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
