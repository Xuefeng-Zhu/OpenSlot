import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database } from '@/lib/types/database'

const DASHBOARD_NOTIFICATION_EVENT_TYPES = [
  'booking.confirmed',
  'booking.cancelled',
  'booking.rescheduled',
] as const

type DashboardNotificationEventType =
  (typeof DASHBOARD_NOTIFICATION_EVENT_TYPES)[number]

interface DashboardNotificationBookingRow {
  id: string
  guest_name: string | null
  event_types: { title: string | null } | { title: string | null }[] | null
}

interface DashboardNotificationEventDataRow {
  id: string
  booking_id: string
  event_type: string
  created_at: string
}

export interface DashboardNotificationEventRow {
  id: string
  booking_id: string
  event_type: string
  created_at: string
  bookings: DashboardNotificationBookingRow | DashboardNotificationBookingRow[] | null
}

export interface DashboardNotification {
  id: string
  bookingId: string
  title: string
  description: string
  occurredAt: string
  href: string
}

export interface DashboardNotifications {
  items: DashboardNotification[]
  unseenCount: number
}

export const emptyDashboardNotifications: DashboardNotifications = {
  items: [],
  unseenCount: 0,
}

/**
 * Loads recent host booking lifecycle events for the dashboard bell menu.
 * Failures intentionally degrade to an empty menu so dashboard navigation is
 * not blocked by optional activity data.
 */
export async function listDashboardNotifications(
  adminClient: BackendCompatClient<Database>,
  profileId: string,
  limit = 5
): Promise<DashboardNotifications> {
  try {
    const [bookingsResult, settingsResult] = await Promise.all([
      adminClient
        .from('bookings')
        .select(
          `
            id,
            guest_name,
            event_types (
              title
            )
          `
        )
        .eq('host_user_id', profileId),
      adminClient
        .from('user_settings')
        .select('notifications_seen_at')
        .eq('profile_id', profileId)
        .maybeSingle(),
    ])

    if (bookingsResult.error) {
      console.error(
        'Error loading dashboard notification bookings:',
        bookingsResult.error
      )
      return emptyDashboardNotifications
    }

    if (settingsResult.error) {
      console.error(
        'Error loading dashboard notification seen state:',
        settingsResult.error
      )
    }

    const bookings =
      (bookingsResult.data as DashboardNotificationBookingRow[] | null) ?? []
    const bookingIds = bookings.map((booking) => booking.id).filter(Boolean)
    const bookingById = new Map(
      bookings.map((booking) => [booking.id, booking])
    )
    let rows: DashboardNotificationEventRow[] = []

    if (bookingIds.length > 0) {
      const eventsResult = await adminClient
        .from('booking_events')
        .select(
          `
            id,
            booking_id,
            event_type,
            created_at
          `
        )
        .in('booking_id', bookingIds)
        .in('event_type', [...DASHBOARD_NOTIFICATION_EVENT_TYPES])
        .order('created_at', { ascending: false })
        .limit(limit)

      if (eventsResult.error) {
        console.error('Error loading dashboard notifications:', eventsResult.error)
        return emptyDashboardNotifications
      }

      rows = (
        (eventsResult.data as DashboardNotificationEventDataRow[] | null) ?? []
      ).map((event) => ({
        ...event,
        bookings: bookingById.get(event.booking_id) ?? null,
      }))
    }

    return buildDashboardNotifications(
      rows,
      {
        seenAt:
          (settingsResult.data as { notifications_seen_at: string | null } | null)
            ?.notifications_seen_at ?? null,
        limit,
      }
    )
  } catch (error) {
    console.error('Error loading dashboard notifications:', error)
    return emptyDashboardNotifications
  }
}

export function buildDashboardNotifications(
  rows: DashboardNotificationEventRow[],
  options: { seenAt?: string | null; limit?: number } = {}
): DashboardNotifications {
  const limit = options.limit ?? 5
  const seenAt = parseSeenAt(options.seenAt)
  const items = buildDashboardNotificationItems(
    rows,
    limit
  )

  return {
    items,
    unseenCount: seenAt
      ? items.filter((notification) => new Date(notification.occurredAt) > seenAt)
          .length
      : items.length,
  }
}

function buildDashboardNotificationItems(
  rows: DashboardNotificationEventRow[],
  limit = 5
): DashboardNotification[] {
  return rows
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .flatMap((row) => {
      const eventType = toDashboardNotificationEventType(row.event_type)
      const booking = firstItem(row.bookings)

      if (!eventType || !booking) {
        return []
      }

      const guestName = booking.guest_name?.trim() || 'A guest'
      const eventTypeTitle = firstItem(booking.event_types)?.title?.trim() || null
      const copy = notificationCopy(eventType, guestName, eventTypeTitle)

      return [
        {
          id: row.id,
          bookingId: row.booking_id,
          title: copy.title,
          description: copy.description,
          occurredAt: row.created_at,
          href: '/bookings',
        },
      ]
    })
    .slice(0, limit)
}

function parseSeenAt(seenAt: string | null | undefined): Date | null {
  if (!seenAt) return null

  const date = new Date(seenAt)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDashboardNotificationEventType(
  eventType: string
): DashboardNotificationEventType | null {
  return DASHBOARD_NOTIFICATION_EVENT_TYPES.includes(
    eventType as DashboardNotificationEventType
  )
    ? (eventType as DashboardNotificationEventType)
    : null
}

function notificationCopy(
  eventType: DashboardNotificationEventType,
  guestName: string,
  eventTypeTitle: string | null
) {
  const possessiveEventTitle = eventTypeTitle || 'appointment'

  switch (eventType) {
    case 'booking.confirmed':
      return {
        title: 'New booking confirmed',
        description: `${guestName} booked ${eventTypeTitle || 'an appointment'}.`,
      }
    case 'booking.cancelled':
      return {
        title: 'Booking cancelled',
        description: `${guestName}'s ${possessiveEventTitle} was cancelled.`,
      }
    case 'booking.rescheduled':
      return {
        title: 'Booking rescheduled',
        description: `${guestName}'s ${possessiveEventTitle} was rescheduled.`,
      }
  }
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}
