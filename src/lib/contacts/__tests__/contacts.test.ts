import { describe, expect, it, vi } from 'vitest'
import {
  anonymizeContact,
  hashContactEmail,
  normalizeContactEmail,
  touchContactForBookingEvent,
  upsertContactFromBooking,
} from '../contacts'

function lookupBuilder(data: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error })),
  }

  return builder
}

function insertBuilder() {
  const state = { payload: null as Record<string, unknown> | null }
  const builder = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.payload = payload
      return builder
    }),
    select: vi.fn(() => builder),
    single: vi.fn(async () => ({
      data: {
        id: 'contact-1',
        ...state.payload,
        deleted_at: null,
        created_at: '2026-05-12T00:00:00.000Z',
        updated_at: '2026-05-12T00:00:00.000Z',
      },
      error: null,
    })),
    state,
  }

  return builder
}

function updateBuilder() {
  const state = { payload: null as Record<string, unknown> | null }
  const builder = {
    update: vi.fn((payload: Record<string, unknown>) => {
      state.payload = payload
      return builder
    }),
    eq: vi.fn(() => builder),
    is: vi.fn(async () => ({ error: null })),
    select: vi.fn(() => builder),
    single: vi.fn(async () => ({
      data: {
        id: 'contact-1',
        host_user_id: 'host-1',
        email_hash: hashContactEmail('jane@example.com'),
        ...state.payload,
      },
      error: null,
    })),
    state,
  }

  return builder
}

describe('contact helpers', () => {
  it('normalizes and hashes contact email identity deterministically', () => {
    expect(normalizeContactEmail('  Jane@Example.COM  ')).toBe('jane@example.com')
    expect(hashContactEmail('Jane@Example.COM')).toBe(hashContactEmail(' jane@example.com '))
    expect(hashContactEmail('jane@example.com')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('inserts a new contact from a confirmed booking', async () => {
    const lookup = lookupBuilder(null)
    const insert = insertBuilder()
    const adminClient = {
      from: vi.fn()
        .mockReturnValueOnce(lookup)
        .mockReturnValueOnce(insert),
    } as any

    const result = await upsertContactFromBooking(adminClient, {
      bookingId: 'booking-1',
      hostUserId: 'host-1',
      guestName: 'Jane Doe',
      guestEmail: ' Jane@Example.COM ',
      guestTimezone: 'America/New_York',
      occurredAt: '2026-05-12T10:00:00.000Z',
    })

    expect(result?.id).toBe('contact-1')
    expect(insert.state.payload).toMatchObject({
      host_user_id: 'host-1',
      email_hash: hashContactEmail('jane@example.com'),
      display_name: 'Jane Doe',
      last_guest_timezone: 'America/New_York',
      first_seen_at: '2026-05-12T10:00:00.000Z',
      last_seen_at: '2026-05-12T10:00:00.000Z',
      last_booking_id: 'booking-1',
    })
  })

  it('refreshes an existing contact and reactivates it after a new booking', async () => {
    const lookup = lookupBuilder({
      id: 'contact-1',
      first_seen_at: '2026-05-10T10:00:00.000Z',
    })
    const update = updateBuilder()
    const adminClient = {
      from: vi.fn()
        .mockReturnValueOnce(lookup)
        .mockReturnValueOnce(update),
    } as any

    await upsertContactFromBooking(adminClient, {
      bookingId: 'booking-2',
      hostUserId: 'host-1',
      guestName: 'Jane Updated',
      guestEmail: 'jane@example.com',
      guestTimezone: 'UTC',
      occurredAt: '2026-05-12T10:00:00.000Z',
    })

    expect(update.state.payload).toMatchObject({
      display_name: 'Jane Updated',
      last_guest_timezone: 'UTC',
      last_seen_at: '2026-05-12T10:00:00.000Z',
      last_booking_id: 'booking-2',
      deleted_at: null,
    })
    expect(update.eq).toHaveBeenCalledWith('id', 'contact-1')
  })

  it('touches only active contacts for lifecycle events', async () => {
    const update = updateBuilder()
    const adminClient = {
      from: vi.fn().mockReturnValue(update),
    } as any

    const result = await touchContactForBookingEvent(adminClient, {
      hostUserId: 'host-1',
      guestEmail: 'jane@example.com',
      occurredAt: '2026-05-12T11:00:00.000Z',
    })

    expect(result).toBe(true)
    expect(update.state.payload).toMatchObject({
      last_seen_at: '2026-05-12T11:00:00.000Z',
    })
    expect(update.eq).toHaveBeenCalledWith('host_user_id', 'host-1')
    expect(update.eq).toHaveBeenCalledWith('email_hash', hashContactEmail('jane@example.com'))
    expect(update.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('calls the anonymization RPC with host scoping', async () => {
    const adminClient = {
      rpc: vi.fn().mockResolvedValue({ data: 3, error: null }),
    } as any

    const result = await anonymizeContact(adminClient, {
      contactId: 'contact-1',
      hostUserId: 'host-1',
    })

    expect(result).toEqual({ success: true, anonymizedBookings: 3 })
    expect(adminClient.rpc).toHaveBeenCalledWith('anonymize_contact_bookings', {
      p_contact_id: 'contact-1',
      p_host_user_id: 'host-1',
    })
  })
})
