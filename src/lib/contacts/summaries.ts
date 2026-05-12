import { hashContactEmail } from './contacts'

export interface ContactRecord {
  id: string
  email_hash: string
  display_name: string | null
  last_guest_timezone: string | null
  first_seen_at: string
  last_seen_at: string
  deleted_at: string | null
}

export interface ContactBookingRecord {
  id: string
  guest_name: string
  guest_email: string
  guest_timezone: string
  notes: string
  start_at: string
  end_at: string
  status: string
  cancel_reason: string | null
  rescheduled_from_booking_id: string | null
  rescheduled_to_booking_id: string | null
  rescheduled_at: string | null
  created_at: string
  updated_at: string
  event_type_title: string
}

export interface ContactEventRecord {
  booking_id: string
  event_type: string
  created_at: string
}

export interface ContactSummary {
  id: string
  displayName: string
  displayEmail: string
  lastGuestTimezone: string | null
  firstSeenAt: string
  lastSeenAt: string
  lastMeetingAt: string | null
  nextMeetingAt: string | null
  totalBookings: number
  upcomingCount: number
  pastCount: number
  cancelledCount: number
  rescheduledCount: number
  eventTitles: string[]
}

export interface ContactTimelineItem {
  bookingId: string
  eventTypeTitle: string
  status: string
  guestName: string
  guestEmail: string
  guestTimezone: string
  notes: string
  startAt: string
  endAt: string
  occurredAt: string
  cancelReason: string | null
  rescheduledFromBookingId: string | null
  rescheduledToBookingId: string | null
}

/**
 * Builds contact summaries from host-scoped contacts and bookings.
 */
export function buildContactSummaries(
  contacts: ContactRecord[],
  bookings: ContactBookingRecord[],
  now: Date = new Date()
): ContactSummary[] {
  const bookingsByHash = groupBookingsByEmailHash(bookings)

  return contacts
    .filter((contact) => !contact.deleted_at)
    .map((contact) => {
      const contactBookings = bookingsByHash.get(contact.email_hash) ?? []
      const sortedBookings = sortBookingsByStart(contactBookings)
      const latestBooking = latestByCreatedAt(contactBookings)
      const upcoming = contactBookings.filter(
        (booking) => booking.status === 'confirmed' && new Date(booking.start_at) > now
      )
      const past = contactBookings.filter(
        (booking) => booking.status === 'confirmed' && new Date(booking.start_at) <= now
      )
      const cancelled = contactBookings.filter((booking) => booking.status === 'cancelled')
      const rescheduled = contactBookings.filter((booking) => booking.status === 'rescheduled')
      const nextMeeting = upcoming
        .slice()
        .sort((a, b) => a.start_at.localeCompare(b.start_at))[0]

      return {
        id: contact.id,
        displayName:
          contact.display_name ||
          latestBooking?.guest_name ||
          'Unknown contact',
        displayEmail: latestBooking?.guest_email ?? '',
        lastGuestTimezone:
          contact.last_guest_timezone || latestBooking?.guest_timezone || null,
        firstSeenAt: contact.first_seen_at,
        lastSeenAt: maxIso([contact.last_seen_at, latestBooking?.updated_at]),
        lastMeetingAt: sortedBookings[0]?.start_at ?? null,
        nextMeetingAt: nextMeeting?.start_at ?? null,
        totalBookings: contactBookings.length,
        upcomingCount: upcoming.length,
        pastCount: past.length,
        cancelledCount: cancelled.length,
        rescheduledCount: rescheduled.length,
        eventTitles: uniqueSorted(contactBookings.map((booking) => booking.event_type_title)),
      }
    })
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
}

/**
 * Builds a reverse-chronological booking lifecycle timeline for one contact.
 */
export function buildContactTimeline(
  contact: ContactRecord,
  bookings: ContactBookingRecord[],
  events: ContactEventRecord[] = []
): ContactTimelineItem[] {
  const eventsByBooking = new Map<string, ContactEventRecord[]>()

  for (const event of events) {
    eventsByBooking.set(event.booking_id, [
      ...(eventsByBooking.get(event.booking_id) ?? []),
      event,
    ])
  }

  return bookings
    .filter((booking) => hashContactEmail(booking.guest_email) === contact.email_hash)
    .sort((a, b) => b.start_at.localeCompare(a.start_at))
    .map((booking) => {
      const lifecycleEvents = eventsByBooking.get(booking.id) ?? []

      return {
        bookingId: booking.id,
        eventTypeTitle: booking.event_type_title,
        status: booking.status,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        guestTimezone: booking.guest_timezone,
        notes: booking.notes,
        startAt: booking.start_at,
        endAt: booking.end_at,
        occurredAt: lifecycleOccurredAt(booking, lifecycleEvents),
        cancelReason: booking.cancel_reason,
        rescheduledFromBookingId: booking.rescheduled_from_booking_id,
        rescheduledToBookingId: booking.rescheduled_to_booking_id,
      }
    })
}

function groupBookingsByEmailHash(bookings: ContactBookingRecord[]) {
  const grouped = new Map<string, ContactBookingRecord[]>()

  for (const booking of bookings) {
    const emailHash = hashContactEmail(booking.guest_email)
    grouped.set(emailHash, [...(grouped.get(emailHash) ?? []), booking])
  }

  return grouped
}

function sortBookingsByStart(bookings: ContactBookingRecord[]) {
  return bookings.slice().sort((a, b) => b.start_at.localeCompare(a.start_at))
}

function latestByCreatedAt(bookings: ContactBookingRecord[]) {
  return bookings
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}

function maxIso(values: Array<string | undefined | null>): string {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0]
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
}

function lifecycleOccurredAt(
  booking: ContactBookingRecord,
  events: ContactEventRecord[]
): string {
  if (booking.status === 'cancelled') {
    return (
      latestEventTime(events, 'booking.cancelled') ??
      booking.updated_at ??
      booking.start_at
    )
  }

  if (booking.status === 'rescheduled') {
    return (
      booking.rescheduled_at ??
      latestEventTime(events, 'booking.rescheduled') ??
      booking.updated_at ??
      booking.start_at
    )
  }

  return latestEventTime(events, 'booking.confirmed') ?? booking.created_at
}

function latestEventTime(
  events: ContactEventRecord[],
  eventType: string
): string | null {
  return (
    events
      .filter((event) => event.event_type === eventType)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      ?.created_at ?? null
  )
}
