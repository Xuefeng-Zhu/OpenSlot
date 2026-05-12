import { describe, expect, it } from 'vitest'
import { hashContactEmail } from '../contacts'
import {
  buildContactSummaries,
  buildContactTimeline,
  type ContactBookingRecord,
  type ContactRecord,
} from '../summaries'

const contact: ContactRecord = {
  id: 'contact-1',
  email_hash: hashContactEmail('jane@example.com'),
  display_name: 'Jane Doe',
  last_guest_timezone: 'America/New_York',
  first_seen_at: '2026-05-10T10:00:00.000Z',
  last_seen_at: '2026-05-12T10:00:00.000Z',
  deleted_at: null,
}

function booking(overrides: Partial<ContactBookingRecord> = {}): ContactBookingRecord {
  return {
    id: 'booking-1',
    guest_name: 'Jane Doe',
    guest_email: 'Jane@Example.COM',
    guest_timezone: 'America/New_York',
    notes: '',
    start_at: '2026-05-20T16:00:00.000Z',
    end_at: '2026-05-20T16:30:00.000Z',
    status: 'confirmed',
    cancel_reason: null,
    rescheduled_from_booking_id: null,
    rescheduled_to_booking_id: null,
    rescheduled_at: null,
    created_at: '2026-05-12T10:00:00.000Z',
    updated_at: '2026-05-12T10:00:00.000Z',
    event_type_title: 'Intro Call',
    ...overrides,
  }
}

describe('contact summaries', () => {
  it('groups bookings by normalized email hash and hides deleted contacts', () => {
    const summaries = buildContactSummaries(
      [
        contact,
        {
          ...contact,
          id: 'deleted-contact',
          deleted_at: '2026-05-12T12:00:00.000Z',
        },
      ],
      [
        booking(),
        booking({
          id: 'booking-2',
          guest_email: ' jane@example.com ',
          status: 'cancelled',
          start_at: '2026-05-01T16:00:00.000Z',
          end_at: '2026-05-01T16:30:00.000Z',
          event_type_title: 'Design Review',
        }),
      ],
      new Date('2026-05-12T12:00:00.000Z')
    )

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      id: 'contact-1',
      displayName: 'Jane Doe',
      displayEmail: 'Jane@Example.COM',
      lastMeetingAt: null,
      nextMeetingAt: '2026-05-20T16:00:00.000Z',
      totalBookings: 2,
      upcomingCount: 1,
      cancelledCount: 1,
      eventTitles: ['Design Review', 'Intro Call'],
    })
  })

  it('derives last meeting from past confirmed bookings only', () => {
    const summaries = buildContactSummaries(
      [contact],
      [
        booking({
          id: 'future-confirmed',
          start_at: '2026-05-20T16:00:00.000Z',
          end_at: '2026-05-20T16:30:00.000Z',
          status: 'confirmed',
        }),
        booking({
          id: 'past-confirmed',
          start_at: '2026-05-10T16:00:00.000Z',
          end_at: '2026-05-10T16:30:00.000Z',
          status: 'confirmed',
        }),
        booking({
          id: 'future-cancelled',
          start_at: '2026-05-25T16:00:00.000Z',
          end_at: '2026-05-25T16:30:00.000Z',
          status: 'cancelled',
        }),
      ],
      new Date('2026-05-12T12:00:00.000Z')
    )

    expect(summaries[0]).toMatchObject({
      lastMeetingAt: '2026-05-10T16:00:00.000Z',
      nextMeetingAt: '2026-05-20T16:00:00.000Z',
    })
  })

  it('builds timeline items with lifecycle event times', () => {
    const timeline = buildContactTimeline(
      contact,
      [
        booking({
          status: 'cancelled',
          cancel_reason: 'No longer needed',
          updated_at: '2026-05-12T12:00:00.000Z',
        }),
      ],
      [
        {
          booking_id: 'booking-1',
          event_type: 'booking.cancelled',
          created_at: '2026-05-12T12:30:00.000Z',
        },
      ]
    )

    expect(timeline).toEqual([
      expect.objectContaining({
        bookingId: 'booking-1',
        status: 'cancelled',
        occurredAt: '2026-05-12T12:30:00.000Z',
        cancelReason: 'No longer needed',
      }),
    ])
  })
})
