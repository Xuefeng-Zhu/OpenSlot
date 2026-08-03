import { describe, expect, it, vi } from 'vitest'
import handler from '../save-availability.v1'

const userId = '11111111-2222-4333-8444-555555555555'
const scheduleId = '22222222-3333-4444-8555-666666666666'
const ruleId = '33333333-4444-4555-8666-777777777777'
const overrideId = '44444444-5555-4666-8777-888888888888'
const deletedRuleId = '55555555-6666-4777-8888-999999999999'
const deletedOverrideId = '66666666-7777-4888-8999-aaaaaaaaaaaa'

const validBody = {
  userId,
  scheduleId,
  timezone: 'America/Los_Angeles',
  rules: [
    {
      id: ruleId,
      weekday: 1,
      start_time: '09:00',
      end_time: '17:00',
      is_active: true,
    },
    {
      weekday: 2,
      start_time: '10:00:00',
      end_time: '16:30:00',
      is_active: false,
    },
  ],
  overrides: [
    {
      id: overrideId,
      date: '2026-08-10',
      start_time: null,
      end_time: null,
      is_available: false,
      reason: 'Out of office',
    },
  ],
  deletedRuleIds: [deletedRuleId],
  deletedOverrideIds: [deletedOverrideId],
}

const savedRules = [
  {
    id: ruleId,
    weekday: 1,
    start_time: '09:00:00',
    end_time: '17:00:00',
    is_active: true,
  },
]
const savedOverrides = [
  {
    id: overrideId,
    date: '2026-08-10',
    start_time: null,
    end_time: null,
    is_available: false,
    reason: 'Out of office',
  },
]

describe('save-availability Butterbase function', () => {
  it('saves the owned schedule and all rows with one parameterized statement', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          schedule_owned: true,
          mutation_allowed: true,
          rules: savedRules,
          overrides: JSON.stringify(savedOverrides),
          deleted_rule_count: 1,
          deleted_override_count: 1,
        },
      ],
    })

    const response = await handler(request(validBody), context(query))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      rules: savedRules,
      overrides: savedOverrides,
    })
    expect(query).toHaveBeenCalledTimes(1)

    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('WITH rule_input AS')
    expect(sql).toContain('UPDATE public.schedules AS schedules')
    expect(sql).toContain('DELETE FROM public.availability_rules AS rules')
    expect(sql).toContain('DELETE FROM public.availability_overrides AS overrides')
    expect(sql).toContain('INSERT INTO public.availability_rules AS target')
    expect(sql).toContain('INSERT INTO public.availability_overrides AS target')
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE')
    expect(sql).toContain('rules.schedule_id = updated_schedule.id')
    expect(sql).toContain('rules.user_id = updated_schedule.user_id')
    expect(sql).toContain('target.schedule_id = EXCLUDED.schedule_id')
    expect(sql).toContain('target.user_id = EXCLUDED.user_id')
    expect(sql).not.toMatch(/\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/i)
    expect(params).toEqual([
      userId,
      scheduleId,
      validBody.timezone,
      JSON.stringify(validBody.rules),
      JSON.stringify(validBody.overrides),
      JSON.stringify(validBody.deletedRuleIds),
      JSON.stringify(validBody.deletedOverrideIds),
    ])
  })

  it('gates every write on schedule and row ownership', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          schedule_owned: true,
          mutation_allowed: false,
          rules: [],
          overrides: [],
        },
      ],
    })

    const response = await handler(request(validBody), context(query))
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data).toEqual({
      success: false,
      error: 'Availability changed; reload and retry',
    })

    const [sql] = query.mock.calls[0]
    expect(sql).toContain('schedules.user_id = $1::uuid')
    expect(sql).toContain('owned_rule.schedule_id = owned_schedule.id')
    expect(sql).toContain('owned_rule.user_id = owned_schedule.user_id')
    expect(sql).toContain('owned_override.schedule_id = owned_schedule.id')
    expect(sql).toContain('owned_override.user_id = owned_schedule.user_id')
    expect(sql).toContain('FROM mutation_guard')
  })

  it('returns a generic not-found response for a schedule the caller does not own', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          schedule_owned: false,
          mutation_allowed: false,
          rules: [],
          overrides: [],
        },
      ],
    })

    const response = await handler(request(validBody), context(query))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Schedule not found',
    })
  })

  it.each([
    ['extra top-level field', { ...validBody, profileEmail: 'private@example.com' }],
    [
      'extra nested rule field',
      {
        ...validBody,
        rules: [{ ...validBody.rules[0], user_id: userId }],
      },
    ],
    [
      'invalid clock time',
      {
        ...validBody,
        rules: [{ ...validBody.rules[0], start_time: '29:00' }],
      },
    ],
    [
      'non-positive time range',
      {
        ...validBody,
        rules: [{ ...validBody.rules[0], start_time: '17:00' }],
      },
    ],
    [
      'invalid calendar date',
      {
        ...validBody,
        overrides: [{ ...validBody.overrides[0], date: '2026-02-30' }],
      },
    ],
    [
      'missing available override hours',
      {
        ...validBody,
        overrides: [
          {
            ...validBody.overrides[0],
            is_available: true,
            start_time: null,
            end_time: null,
          },
        ],
      },
    ],
    [
      'duplicate supplied row ids',
      {
        ...validBody,
        rules: [validBody.rules[0], validBody.rules[0]],
      },
    ],
    [
      'row id also requested for deletion',
      {
        ...validBody,
        deletedRuleIds: [ruleId],
      },
    ],
  ])('rejects %s before querying the database', async (_label, body) => {
    const query = vi.fn()

    const response = await handler(request(body), context(query))

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
      error: 'Unable to save availability',
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
  return new Request('https://api.butterbase.ai/save-availability', {
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
