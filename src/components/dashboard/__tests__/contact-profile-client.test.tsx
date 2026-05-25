import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactProfileClient } from '../contact-profile-client'
import type {
  ContactSummary,
  ContactTimelineItem,
} from '@/lib/contacts/summaries'

const toastMock = vi.hoisted(() => vi.fn())
const pushMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

const contact: ContactSummary = {
  id: 'contact-1',
  displayName: 'Ada Lovelace',
  displayEmail: 'ada@example.com',
  lastGuestTimezone: 'Europe/London',
  firstSeenAt: '2026-05-10T10:00:00.000Z',
  lastSeenAt: '2026-05-12T10:00:00.000Z',
  lastMeetingAt: '2026-05-11T10:00:00.000Z',
  nextMeetingAt: '2026-05-20T10:00:00.000Z',
  totalBookings: 2,
  upcomingCount: 1,
  pastCount: 1,
  cancelledCount: 0,
  rescheduledCount: 0,
  eventTitles: ['Design Review'],
}

const timeline: ContactTimelineItem[] = [
  {
    bookingId: 'booking-1',
    eventTypeTitle: 'Design Review',
    status: 'confirmed',
    guestName: 'Ada Lovelace',
    guestEmail: 'ada@example.com',
    guestTimezone: 'Europe/London',
    notes: '',
    startAt: '2026-05-20T10:00:00.000Z',
    endAt: '2026-05-20T10:30:00.000Z',
    occurredAt: '2026-05-12T10:00:00.000Z',
    cancelReason: null,
    rescheduledFromBookingId: null,
    rescheduledToBookingId: null,
  },
]

describe('ContactProfileClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    toastMock.mockClear()
    pushMock.mockClear()
    refreshMock.mockClear()
  })

  it('shows the anonymize fallback when the API returns a non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Unexpected token')
        },
      })
    )

    render(<ContactProfileClient contact={contact} timeline={timeline} />)

    fireEvent.click(screen.getByRole('button', { name: 'Anonymize contact' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anonymize' }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Failed to anonymize contact',
          variant: 'destructive',
        })
      )
    })
    expect(pushMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
