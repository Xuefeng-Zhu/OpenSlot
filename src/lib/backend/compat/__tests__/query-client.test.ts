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
