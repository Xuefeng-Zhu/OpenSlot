import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mergeBookingAgentDrafts, SlotPicker } from '../slot-picker'

type SlotPickerProps = ComponentProps<typeof SlotPicker>

const eventType: SlotPickerProps['eventType'] = {
  id: 'event-type-1',
  title: 'Discovery Call',
  slug: 'discovery-call',
  description: 'A short intro call.',
  duration_minutes: 30,
  location_type: 'video',
  location_value: null,
  video_provider: null,
  invitee_questions: [],
  user_id: 'host-1',
}

const hostProfile: SlotPickerProps['hostProfile'] = {
  id: 'host-1',
  name: 'Sarah Chen',
  username: 'sarah',
  avatar_url: null,
}

describe('SlotPicker', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders with a valid timezone before browser detection succeeds', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ slotsByDate: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: '' }),
        }) as Intl.DateTimeFormat
    )

    expect(() =>
      render(<SlotPicker eventType={eventType} hostProfile={hostProfile} />)
    ).not.toThrow()

    expect(screen.getByLabelText('Timezone')).toBeDefined()
    expect(screen.getByText('UTC')).toBeDefined()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(String(fetchMock.mock.calls[0][0])).toContain('startDate=')
    expect(String(fetchMock.mock.calls[0][0])).toContain('endDate=')
  })

  it('sends an idempotency key when holding an assistant-suggested slot', async () => {
    const suggestedSlot = {
      start: '2026-06-16T16:00:00.000Z',
      end: '2026-06-16T16:30:00.000Z',
      label: 'Tue, Jun 16, 9:00 AM',
      slotToken: 'signed-slot-token',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('/api/slots')) {
        return new Response(JSON.stringify({ slotsByDate: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url === '/api/booking-agent/message') {
        return new Response(
          JSON.stringify({
            success: true,
            reply: 'I found one option.',
            suggestedSlots: [suggestedSlot],
            nextAction: 'show_slots',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (url === '/api/holds') {
        return new Response(
          JSON.stringify({
            holdId: '33333333-3333-4333-8333-333333333333',
            holdToken: '44444444-4444-4444-8444-444444444444',
            expiresAt: '2026-06-16T16:05:00.000Z',
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: 'America/Los_Angeles' }),
        }) as Intl.DateTimeFormat
    )

    render(
      <SlotPicker
        eventType={eventType}
        hostProfile={hostProfile}
        bookingAgentEnabled
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'AI assistant' }))
    fireEvent.change(screen.getByLabelText('Message the booking assistant'), {
      target: { value: 'next Tuesday morning' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    fireEvent.click(
      await screen.findByRole('button', { name: /Tue, Jun 16, 9:00 AM/ })
    )

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/holds'))
        .toBe(true)
    )

    const holdCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === '/api/holds'
    )
    const holdInit = holdCall?.[1] as RequestInit
    const headers = holdInit.headers as Record<string, string>
    const body = JSON.parse(String(holdInit.body)) as {
      idempotencyKey?: string
      slotToken?: string
    }

    expect(body.idempotencyKey).toBeDefined()
    expect(headers['Idempotency-Key']).toBe(body.idempotencyKey)
    expect(body.slotToken).toBe('signed-slot-token')
  })

  it('shows assistant-suggested hold failures before a date is selected', async () => {
    const suggestedSlot = {
      start: '2026-06-16T16:00:00.000Z',
      end: '2026-06-16T16:30:00.000Z',
      label: 'Tue, Jun 16, 9:00 AM',
      slotToken: 'signed-slot-token',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith('/api/slots')) {
        return new Response(JSON.stringify({ slotsByDate: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url === '/api/booking-agent/message') {
        return new Response(
          JSON.stringify({
            success: true,
            reply: 'I found one option.',
            suggestedSlots: [suggestedSlot],
            nextAction: 'show_slots',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (url === '/api/holds') {
        return new Response(
          JSON.stringify({
            error: 'This slot has already been held.',
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    mockBrowserTimezone('America/Los_Angeles')

    render(
      <SlotPicker
        eventType={eventType}
        hostProfile={hostProfile}
        bookingAgentEnabled
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'AI assistant' }))
    fireEvent.change(screen.getByLabelText('Message the booking assistant'), {
      target: { value: 'next Tuesday morning' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Tue, Jun 16, 9:00 AM/ })
    )

    expect(
      await screen.findByText(
        'This slot has been taken by another guest. Please select a different time.'
      )
    ).toBeDefined()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDefined()
  })

  it('ignores stale slot fetch failures after a newer date request starts', async () => {
    const staleRequest = createDeferredResponse()
    const staleDate = addDays(new Date(), 3)
    const currentDate = addDays(new Date(), 4)
    const staleDateKey = format(staleDate, 'yyyy-MM-dd')
    const currentDateKey = format(currentDate, 'yyyy-MM-dd')
    const currentSlot = {
      start: `${currentDateKey}T14:00:00.000Z`,
      end: `${currentDateKey}T14:30:00.000Z`,
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes(`startDate=${staleDateKey}`)) {
        return staleRequest.promise
      }

      if (url.includes(`startDate=${currentDateKey}`)) {
        return new Response(
          JSON.stringify({
            slotsByDate: {
              [currentDateKey]: [currentSlot],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(JSON.stringify({ slotsByDate: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    mockBrowserTimezone('America/New_York')

    render(<SlotPicker eventType={eventType} hostProfile={hostProfile} />)

    fireEvent.click(
      await screen.findByLabelText(new RegExp(format(staleDate, 'MMMM d'), 'i'))
    )
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(`startDate=${staleDateKey}`)
        )
      ).toBe(true)
    )

    fireEvent.click(
      screen.getByLabelText(new RegExp(format(currentDate, 'MMMM d'), 'i'))
    )
    expect(await screen.findByRole('button', { name: /10:00 AM/i })).toBeDefined()

    staleRequest.resolve(
      new Response(JSON.stringify({ error: 'Stale slot lookup failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await waitFor(() =>
      expect(screen.queryByText('Stale slot lookup failed')).toBeNull()
    )
    expect(screen.getByRole('button', { name: /10:00 AM/i })).toBeDefined()
  })

  it('ignores stale hold responses after the selected date changes', async () => {
    const holdRequest = createDeferredResponse()
    const heldDate = addDays(new Date(), 3)
    const nextDate = addDays(new Date(), 4)
    const heldDateKey = format(heldDate, 'yyyy-MM-dd')
    const nextDateKey = format(nextDate, 'yyyy-MM-dd')
    const heldSlot = {
      start: `${heldDateKey}T14:00:00.000Z`,
      end: `${heldDateKey}T14:30:00.000Z`,
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith('/api/slots')) {
        return new Response(
          JSON.stringify({
            slotsByDate: {
              [heldDateKey]: [heldSlot],
              [nextDateKey]: [],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (url === '/api/holds') {
        return holdRequest.promise
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    mockBrowserTimezone('America/New_York')

    render(<SlotPicker eventType={eventType} hostProfile={hostProfile} />)

    fireEvent.click(
      await screen.findByLabelText(new RegExp(format(heldDate, 'MMMM d'), 'i'))
    )
    fireEvent.click(await screen.findByRole('button', { name: /10:00 AM/i }))
    expect(await screen.findByText('Confirm your booking')).toBeDefined()

    fireEvent.click(
      screen.getByLabelText(new RegExp(format(nextDate, 'MMMM d'), 'i'))
    )
    expect(screen.queryByText('Confirm your booking')).toBeNull()

    holdRequest.resolve(
      new Response(
        JSON.stringify({
          holdId: '33333333-3333-4333-8333-333333333333',
          holdToken: '44444444-4444-4444-8444-444444444444',
          expiresAt: '2026-06-16T16:05:00.000Z',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )

    await waitFor(() =>
      expect(screen.queryByText('Confirm your booking')).toBeNull()
    )
  })

  it('deep merges booking assistant draft answers across turns', () => {
    expect(
      mergeBookingAgentDrafts(
        {
          guestName: 'Jane',
          answers: {
            topic: 'Onboarding',
          },
        },
        {
          guestEmail: 'jane@example.com',
          answers: {
            sendSummary: true,
          },
        }
      )
    ).toEqual({
      guestName: 'Jane',
      guestEmail: 'jane@example.com',
      answers: {
        topic: 'Onboarding',
        sendSummary: true,
      },
    })
  })
})

function createDeferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((next) => {
    resolve = next
  })

  return { promise, resolve }
}

function mockBrowserTimezone(timeZone: string) {
  const DateTimeFormat = Intl.DateTimeFormat

  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    ((locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) => {
      const formatter = new DateTimeFormat(locales, options)

      if (locales === undefined && options === undefined) {
        const resolvedOptions = formatter.resolvedOptions.bind(formatter)
        return Object.assign(formatter, {
          resolvedOptions: () => ({
            ...resolvedOptions(),
            timeZone,
          }),
        })
      }

      return formatter
    }) as typeof Intl.DateTimeFormat
  )
}
