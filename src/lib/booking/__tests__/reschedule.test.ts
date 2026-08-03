import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rescheduleBooking } from '../reschedule'
import { appendBookingEvent } from '../events'
import { upsertContactFromBooking } from '@/lib/contacts/contacts'
import {
  enqueueBookingRescheduledOutbox,
  enqueueConfiguredBookingReminderOutbox,
} from '@/lib/outbox/outbox'

vi.mock('../events', () => ({
  appendBookingEvent: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/outbox/outbox', () => ({
  enqueueBookingRescheduledOutbox: vi.fn().mockResolvedValue({
    queued: 4,
    duplicates: 0,
    failed: 0,
  }),
  enqueueConfiguredBookingReminderOutbox: vi.fn().mockResolvedValue({
    queued: 0,
    duplicates: 0,
    failed: 0,
  }),
}))

vi.mock('@/lib/contacts/contacts', () => ({
  upsertContactFromBooking: vi.fn().mockResolvedValue(null),
}))

const rpcRow = {
  old_booking_id: 'old-booking-1',
  new_booking_id: 'new-booking-1',
  event_type_id: 'event-type-1',
  host_user_id: 'profile-1',
  start_at: '2026-05-08T16:00:00.000Z',
  end_at: '2026-05-08T16:30:00.000Z',
  previous_start_at: '2026-05-07T16:00:00.000Z',
  previous_end_at: '2026-05-07T16:30:00.000Z',
  cancellation_token: 'cancel-token-2',
  reschedule_token: 'reschedule-token-2',
  conference_status: 'pending',
  conference_url: null,
}

const validInput = {
  rescheduleToken: 'reschedule-token-1',
  holdToken: 'hold-token-1',
  guestName: 'Sarah Chen',
  guestEmail: 'sarah@example.com',
  guestTimezone: 'America/Los_Angeles',
  notes: 'New time works better.',
}

function createAdminBackendClient({
  rpcResult,
  inviteeQuestions = [],
}: {
  rpcResult: unknown
  inviteeQuestions?: unknown[]
}) {
  const bookingsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { event_type_id: 'event-type-1' },
      error: null,
    }),
  }
  const eventTypesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { invitee_questions: inviteeQuestions },
      error: null,
    }),
  }

  return {
    from: vi.fn((table: string) =>
      table === 'bookings' ? bookingsQuery : eventTypesQuery
    ),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }
}

describe('rescheduleBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(upsertContactFromBooking).mockResolvedValue(null)
    vi.mocked(enqueueConfiguredBookingReminderOutbox).mockResolvedValue({
      queued: 0,
      duplicates: 0,
      failed: 0,
    })
  })

  it('uses the atomic reschedule RPC and queues side effects', async () => {
    const adminClient = createAdminBackendClient({
      rpcResult: { data: [rpcRow], error: null },
    }) as any

    const result = await rescheduleBooking(validInput, adminClient)

    expect(result).toEqual({
      success: true,
      bookingId: 'new-booking-1',
      previousBookingId: 'old-booking-1',
      cancellationToken: 'cancel-token-2',
      rescheduleToken: 'reschedule-token-2',
      conferenceStatus: 'pending',
      conferenceUrl: null,
      startAt: '2026-05-08T16:00:00.000Z',
      endAt: '2026-05-08T16:30:00.000Z',
      previousStartAt: '2026-05-07T16:00:00.000Z',
      previousEndAt: '2026-05-07T16:30:00.000Z',
    })
    expect(adminClient.rpc).toHaveBeenCalledWith('reschedule_booking_with_hold', {
      p_reschedule_token: 'reschedule-token-1',
      p_hold_token: 'hold-token-1',
      p_guest_name: 'Sarah Chen',
      p_guest_email: 'sarah@example.com',
      p_guest_timezone: 'America/Los_Angeles',
      p_notes: 'New time works better.',
      p_booking_answers: [],
    })
    expect(appendBookingEvent).toHaveBeenCalledTimes(2)
    expect(upsertContactFromBooking).toHaveBeenCalledWith(adminClient, {
      bookingId: 'new-booking-1',
      hostUserId: 'profile-1',
      guestName: 'Sarah Chen',
      guestEmail: 'sarah@example.com',
      guestTimezone: 'America/Los_Angeles',
    })
    expect(enqueueBookingRescheduledOutbox).toHaveBeenCalledWith(adminClient, {
      bookingId: 'new-booking-1',
      previousBookingId: 'old-booking-1',
      eventTypeId: 'event-type-1',
      hostUserId: 'profile-1',
      startAt: '2026-05-08T16:00:00.000Z',
      endAt: '2026-05-08T16:30:00.000Z',
      previousStartAt: '2026-05-07T16:00:00.000Z',
      previousEndAt: '2026-05-07T16:30:00.000Z',
    })
    expect(enqueueConfiguredBookingReminderOutbox).toHaveBeenCalledWith(
      adminClient,
      {
        bookingId: 'new-booking-1',
        eventTypeId: 'event-type-1',
        hostUserId: 'profile-1',
        startAt: '2026-05-08T16:00:00.000Z',
        endAt: '2026-05-08T16:30:00.000Z',
      }
    )
  })

  it('returns the committed reschedule when a follow-up side effect fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(appendBookingEvent).mockRejectedValueOnce(
      new Error('temporary event write failure')
    )
    const adminClient = createAdminBackendClient({
      rpcResult: { data: [rpcRow], error: null },
    }) as any

    const result = await rescheduleBooking(validInput, adminClient)

    expect(result).toMatchObject({
      success: true,
      bookingId: 'new-booking-1',
      previousBookingId: 'old-booking-1',
    })
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('reschedule committed'),
      expect.any(Error)
    )
    consoleError.mockRestore()
  })

  it('passes validated invitee answers into the reschedule RPC', async () => {
    const adminClient = createAdminBackendClient({
      rpcResult: { data: [rpcRow], error: null },
      inviteeQuestions: [
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          required: true,
          options: ['High', 'Low'],
        },
      ],
    }) as any

    await rescheduleBooking(
      {
        ...validInput,
        answers: { priority: 'High' },
      },
      adminClient
    )

    expect(adminClient.rpc).toHaveBeenCalledWith(
      'reschedule_booking_with_hold',
      expect.objectContaining({
        p_booking_answers: [
          {
            questionId: 'priority',
            label: 'Priority',
            type: 'select',
            required: true,
            value: 'High',
          },
        ],
      })
    )
  })

  it('maps expired holds to a guest-safe error', async () => {
    const adminClient = createAdminBackendClient({
      rpcResult: {
        data: null,
        error: { code: 'P0001', message: 'hold_expired' },
      },
    }) as any

    const result = await rescheduleBooking(validInput, adminClient)

    expect(result).toEqual({
      success: false,
      error: 'Hold has expired. Please select a new slot.',
    })
    expect(enqueueBookingRescheduledOutbox).not.toHaveBeenCalled()
    expect(enqueueConfiguredBookingReminderOutbox).not.toHaveBeenCalled()
  })

  it('maps database overlap conflicts to slot-taken', async () => {
    const adminClient = createAdminBackendClient({
      rpcResult: {
        data: null,
        error: { code: '23P01', message: 'conflict' },
      },
    }) as any

    const result = await rescheduleBooking(validInput, adminClient)

    expect(result).toEqual({
      success: false,
      error: 'This slot has been booked by someone else. Please select a different time.',
    })
  })
})
