import { describe, expect, it, vi } from 'vitest'
import { createBackendCompatClient } from '../query-client'

describe('createBackendCompatClient', () => {
  it('serializes fluent select filters, ordering, limits, and single responses', async () => {
    const fetchImpl = mockFetch([
      { id: 'event-type-1', title: 'Discovery Call' },
    ])
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await client
      .from('event_types')
      .select('id,title', { count: 'exact' })
      .eq('user_id', 'host-1')
      .in('status', ['active', 'error'])
      .order('created_at', { ascending: false })
      .limit(10)
      .single()

    expect(result).toEqual({
      data: { id: 'event-type-1', title: 'Discovery Call' },
      error: null,
      count: 1,
    })
    const url = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(url.pathname).toBe('/v1/app_openslot/event_types')
    expect(url.searchParams.get('select')).toBe('id,title')
    expect(url.searchParams.get('user_id')).toBe('eq.host-1')
    expect(url.searchParams.get('status')).toBe('in.(active,error)')
    expect(url.searchParams.get('order')).toBe('created_at.desc')
    expect(url.searchParams.get('limit')).toBe('10')
  })

  it('hydrates event type relation selections used by dashboard booking reads', async () => {
    const fetchImpl = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse([])
      )
      .mockResolvedValueOnce(jsonResponse([
        { id: 'booking-1', event_type_id: 'event-type-1' },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 'event-type-1', title: 'Discovery Call' },
      ]))
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await client
      .from('bookings')
      .select('id,event_type_id,event_types(title)')

    expect(result.data).toEqual([
      {
        id: 'booking-1',
        event_type_id: 'event-type-1',
        event_types: { id: 'event-type-1', title: 'Discovery Call' },
      },
    ])
    expect(String(fetchImpl.mock.calls[0][0])).toContain('select=id%2Cevent_type_id')
    expect(String(fetchImpl.mock.calls[1][0])).toContain('/event_types?')
    expect(String(fetchImpl.mock.calls[1][0])).toContain('id=in.%28event-type-1%29')
  })

  it('serializes JSON columns before table writes', async () => {
    const fetchImpl = mockFetch({
      id: 'event-type-1',
      invitee_questions: [
        {
          id: 'question-1',
          label: 'What should we cover?',
          type: 'text',
          required: true,
        },
      ],
    })
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      fetchImpl,
    })

    await client.from('event_types').insert({
      user_id: 'profile-1',
      title: 'Discovery Call',
      invitee_questions: [
        {
          id: 'question-1',
          label: 'What should we cover?',
          type: 'text',
          required: true,
        },
      ],
    })

    await client.from('bookings').insert({
      event_type_id: 'event-type-1',
      host_user_id: 'profile-1',
      booking_answers: [
        {
          questionId: 'question-1',
          label: 'What should we cover?',
          value: 'Hiring plan',
        },
      ],
    })

    await client.from('provider_connections').insert({
      profile_id: 'profile-1',
      provider: 'google',
      account_email: 'host@example.com',
      scopes: ['calendar.readonly'],
      metadata: {
        accountId: 'external-account-1',
      },
    })

    await client.from('outbox_events').insert({
      aggregate_type: 'booking',
      aggregate_id: 'booking-1',
      event_type: 'booking.confirmed',
      dedupe_key: 'booking-1:confirmed',
      payload: {
        bookingId: 'booking-1',
        hostUserId: 'profile-1',
      },
    })

    const eventTypeBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      invitee_questions?: unknown
    }
    const bookingBody = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)) as {
      booking_answers?: unknown
    }
    const providerConnectionBody = JSON.parse(
      String(fetchImpl.mock.calls[2][1]?.body)
    ) as {
      metadata?: unknown
      scopes?: unknown
    }
    const outboxBody = JSON.parse(String(fetchImpl.mock.calls[3][1]?.body)) as {
      payload?: unknown
    }

    expect(eventTypeBody.invitee_questions).toBe(
      JSON.stringify([
        {
          id: 'question-1',
          label: 'What should we cover?',
          type: 'text',
          required: true,
        },
      ])
    )
    expect(bookingBody.booking_answers).toBe(
      JSON.stringify([
        {
          questionId: 'question-1',
          label: 'What should we cover?',
          value: 'Hiring plan',
        },
      ])
    )
    expect(providerConnectionBody.scopes).toEqual(['calendar.readonly'])
    expect(providerConnectionBody.metadata).toBe(
      JSON.stringify({
        accountId: 'external-account-1',
      })
    )
    expect(outboxBody.payload).toBe(
      JSON.stringify({
        bookingId: 'booking-1',
        hostUserId: 'profile-1',
      })
    )
  })

  it('patches existing user settings rows by provider row id after profile_id conflict lookup', async () => {
    const fetchImpl = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(null)
      )
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 'settings-row-1',
          profile_id: 'profile-1',
          time_format: '12h',
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        id: 'settings-row-1',
        profile_id: 'profile-1',
        time_format: '24h',
      }))
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await client
      .from('user_settings')
      .upsert(
        {
          profile_id: 'profile-1',
          time_format: '24h',
        },
        { onConflict: 'profile_id' }
      )
      .single()

    expect(result.data).toEqual({
      id: 'settings-row-1',
      profile_id: 'profile-1',
      time_format: '24h',
    })

    const conflictLookupUrl = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(conflictLookupUrl.pathname).toBe('/v1/app_openslot/user_settings')
    expect(conflictLookupUrl.searchParams.get('profile_id')).toBe('eq.profile-1')

    expect(fetchImpl.mock.calls[1][0]).toBe(
      'https://api.example.test/v1/app_openslot/user_settings/settings-row-1'
    )
    expect(fetchImpl.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          profile_id: 'profile-1',
          time_format: '24h',
        }),
      })
    )
  })

  it('patches existing user settings rows by profile_id when provider row id is absent', async () => {
    const fetchImpl = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(null)
      )
      .mockResolvedValueOnce(jsonResponse([
        {
          profile_id: 'profile-1',
          time_format: '12h',
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        profile_id: 'profile-1',
        time_format: '24h',
      }))
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await client
      .from('user_settings')
      .upsert(
        {
          profile_id: 'profile-1',
          time_format: '24h',
        },
        { onConflict: 'profile_id' }
      )
      .single()

    expect(result.data).toEqual({
      profile_id: 'profile-1',
      time_format: '24h',
    })
    const updateUrl = new URL(String(fetchImpl.mock.calls[1][0]))
    expect(updateUrl.pathname).toBe('/v1/app_openslot/user_settings')
    expect(updateUrl.searchParams.get('profile_id')).toBe('eq.profile-1')
    expect(fetchImpl.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('deletes existing user settings rows by profile_id when provider row id is absent', async () => {
    const fetchImpl = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(null)
      )
      .mockResolvedValueOnce(jsonResponse([
        {
          profile_id: 'profile-1',
          time_format: '24h',
        },
      ]))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      fetchImpl,
    })

    const result = await client
      .from('user_settings')
      .delete()
      .eq('profile_id', 'profile-1')

    expect(result.error).toBeNull()
    const deleteUrl = new URL(String(fetchImpl.mock.calls[1][0]))
    expect(deleteUrl.pathname).toBe('/v1/app_openslot/user_settings')
    expect(deleteUrl.searchParams.get('profile_id')).toBe('eq.profile-1')
    expect(fetchImpl.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('maps legacy slot-hold RPC calls to Butterbase function requests', async () => {
    const fetchImpl = mockFetch({
      holdId: 'hold-1',
      holdToken: 'hold-token-1',
      expiresAt: '2026-06-16T16:05:00.000Z',
    })
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      functionSecret: 'function-secret',
      fetchImpl,
    })

    const result = await client
      .rpc('create_slot_hold_with_reservation', {
        p_event_type_id: 'event-type-1',
        p_host_user_id: 'host-1',
        p_start_at: '2026-06-16T16:00:00.000Z',
        p_end_at: '2026-06-16T16:30:00.000Z',
        p_guest_email: 'guest@example.com',
        p_expires_at: '2026-06-16T16:05:00.000Z',
      })
      .single()

    expect(result.data).toEqual({
      hold_id: 'hold-1',
      hold_token: 'hold-token-1',
      expires_at: '2026-06-16T16:05:00.000Z',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/v1/app_openslot/fn/create-slot-hold',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          eventTypeId: 'event-type-1',
          hostUserId: 'host-1',
          startAt: '2026-06-16T16:00:00.000Z',
          endAt: '2026-06-16T16:30:00.000Z',
          guestEmail: 'guest@example.com',
          expiresAt: '2026-06-16T16:05:00.000Z',
        }),
      })
    )
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get('Authorization')).toBe(
      'Bearer function-secret'
    )
  })

  it('maps availability save RPC calls to the atomic Butterbase function', async () => {
    const savedAvailability = {
      rules: [
        {
          id: 'rule-1',
          weekday: 1,
          start_time: '09:00',
          end_time: '17:00',
          is_active: true,
        },
      ],
      overrides: [],
    }
    const fetchImpl = mockFetch(savedAvailability)
    const client = createBackendCompatClient({
      appId: 'app_openslot',
      apiUrl: 'https://api.example.test',
      apiKey: 'service-key',
      functionSecret: 'function-secret',
      fetchImpl,
    })

    const result = await client
      .rpc('save_availability', {
        p_user_id: 'host-1',
        p_schedule_id: 'schedule-1',
        p_timezone: 'America/New_York',
        p_rules: savedAvailability.rules,
        p_overrides: [],
        p_deleted_rule_ids: ['rule-2'],
        p_deleted_override_ids: [],
      })
      .single()

    expect(result.data).toEqual(savedAvailability)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/v1/app_openslot/fn/save-availability',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: 'host-1',
          scheduleId: 'schedule-1',
          timezone: 'America/New_York',
          rules: savedAvailability.rules,
          overrides: [],
          deletedRuleIds: ['rule-2'],
          deletedOverrideIds: [],
        }),
      })
    )
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get('Authorization')).toBe(
      'Bearer function-secret'
    )
  })
})

function mockFetch(body: unknown) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    jsonResponse(body)
  )
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
