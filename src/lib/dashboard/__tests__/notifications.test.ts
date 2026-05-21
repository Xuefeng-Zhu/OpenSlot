import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/types/database'
import {
  buildDashboardNotifications,
  listDashboardNotifications,
  type DashboardNotificationEventRow,
} from '../notifications'

afterEach(() => {
  vi.restoreAllMocks()
})

function eventRow(
  overrides: Partial<DashboardNotificationEventRow>
): DashboardNotificationEventRow {
  return {
    id: 'event-1',
    booking_id: 'booking-1',
    event_type: 'booking.confirmed',
    created_at: '2026-05-16T17:00:00.000Z',
    bookings: {
      id: 'booking-1',
      guest_name: 'Alex Lee',
      event_types: { title: 'Discovery Call' },
    },
    ...overrides,
  }
}

describe('buildDashboardNotifications', () => {
  it('maps booking lifecycle events into newest-first notifications', () => {
    const notifications = buildDashboardNotifications(
      [
        eventRow({
          id: 'older',
          booking_id: 'booking-older',
          event_type: 'booking.confirmed',
          created_at: '2026-05-16T17:00:00.000Z',
          bookings: {
            id: 'booking-older',
            guest_name: 'Alex Lee',
            event_types: { title: 'Discovery Call' },
          },
        }),
        eventRow({
          id: 'newer',
          booking_id: 'booking-newer',
          event_type: 'booking.cancelled',
          created_at: '2026-05-16T18:00:00.000Z',
          bookings: {
            id: 'booking-newer',
            guest_name: 'Sam Rivera',
            event_types: [{ title: 'Strategy Session' }],
          },
        }),
      ],
      { seenAt: '2026-05-16T17:30:00.000Z' }
    )

    expect(notifications).toEqual({
      items: [
        {
          id: 'newer',
          bookingId: 'booking-newer',
          title: 'Booking cancelled',
          description: "Sam Rivera's Strategy Session was cancelled.",
          occurredAt: '2026-05-16T18:00:00.000Z',
          href: '/bookings',
        },
        {
          id: 'older',
          bookingId: 'booking-older',
          title: 'New booking confirmed',
          description: 'Alex Lee booked Discovery Call.',
          occurredAt: '2026-05-16T17:00:00.000Z',
          href: '/bookings',
        },
      ],
      unseenCount: 1,
    })
  })

  it('caps results and skips unknown or incomplete event rows', () => {
    const notifications = buildDashboardNotifications(
      [
        eventRow({
          id: 'unknown',
          event_type: 'notifications.requested',
          created_at: '2026-05-16T20:00:00.000Z',
        }),
        eventRow({
          id: 'missing-booking',
          bookings: null,
          created_at: '2026-05-16T19:00:00.000Z',
        }),
        eventRow({
          id: 'rescheduled',
          booking_id: 'booking-rescheduled',
          event_type: 'booking.rescheduled',
          created_at: '2026-05-16T18:00:00.000Z',
          bookings: {
            id: 'booking-rescheduled',
            guest_name: null,
            event_types: null,
          },
        }),
        eventRow({
          id: 'confirmed',
          booking_id: 'booking-confirmed',
          event_type: 'booking.confirmed',
          created_at: '2026-05-16T17:00:00.000Z',
        }),
      ],
      { limit: 1 }
    )

    expect(notifications).toEqual({
      items: [
        {
          id: 'rescheduled',
          bookingId: 'booking-rescheduled',
          title: 'Booking rescheduled',
          description: "A guest's appointment was rescheduled.",
          occurredAt: '2026-05-16T18:00:00.000Z',
          href: '/bookings',
        },
      ],
      unseenCount: 1,
    })
  })

  it('clears unseen count when every recent notification is at or before the seen time', () => {
    const notifications = buildDashboardNotifications(
      [
        eventRow({
          id: 'event-2',
          created_at: '2026-05-16T18:00:00.000Z',
        }),
        eventRow({
          id: 'event-1',
          created_at: '2026-05-16T17:00:00.000Z',
        }),
      ],
      { seenAt: '2026-05-16T18:00:00.000Z' }
    )

    expect(notifications.items).toHaveLength(2)
    expect(notifications.unseenCount).toBe(0)
  })
})

describe('listDashboardNotifications', () => {
  it('logs and falls back to an empty list when loading fails', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.limit.mockResolvedValue({
      data: null,
      error: new Error('database unavailable'),
    })
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })

    const adminClient = {
      from: vi.fn(() => query),
    } as unknown as BackendCompatClient<Database>
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await expect(
      listDashboardNotifications(adminClient, 'profile-1')
    ).resolves.toEqual({ items: [], unseenCount: 0 })

    expect(consoleError).toHaveBeenCalledWith(
      'Error loading dashboard notifications:',
      expect.any(Error)
    )
  })
})
