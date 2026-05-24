import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingAgentPanel } from '../booking-agent-panel'

describe('BookingAgentPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends chat turns, applies draft values, and selects suggested slots', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          success: true,
          reply: 'I found a time that may work.',
          suggestedSlots: [
            {
              start: '2026-06-16T18:00:00.000Z',
              end: '2026-06-16T18:30:00.000Z',
              label: 'Tue, Jun 16, 2:00 PM',
            },
          ],
          draft: {
            guestName: 'Jane Doe',
            guestEmail: 'jane@example.com',
          },
          nextAction: 'show_slots',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const onDraftChange = vi.fn()
    const onSelectSlot = vi.fn()

    render(
      <BookingAgentPanel
        mode="booking"
        eventTypeId="11111111-1111-4111-8111-111111111111"
        hostUserId="22222222-2222-4222-8222-222222222222"
        timezone="America/New_York"
        selectedDate="2026-06-16"
        selectedSlot={null}
        onDraftChange={onDraftChange}
        onSelectSlot={onSelectSlot}
      />
    )

    expect(
      screen.queryByLabelText('Message the booking assistant')
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /AI assistant/i }))

    fireEvent.change(screen.getByLabelText('Message the booking assistant'), {
      target: { value: 'I can do Tuesday afternoon. I am Jane.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await screen.findByText('I found a time that may work.')
    expect(onDraftChange).toHaveBeenCalledWith({
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
    })

    fireEvent.click(screen.getByRole('button', { name: /Tue, Jun 16/ }))
    expect(onSelectSlot).toHaveBeenCalledWith({
      start: '2026-06-16T18:00:00.000Z',
      end: '2026-06-16T18:30:00.000Z',
      label: 'Tue, Jun 16, 2:00 PM',
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      mode: 'booking',
      eventTypeId: '11111111-1111-4111-8111-111111111111',
      hostUserId: '22222222-2222-4222-8222-222222222222',
      timezone: 'America/New_York',
      clientState: {
        selectedDate: '2026-06-16',
      },
    })
  })

  it('keeps suggested holds disabled while verification is required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            reply: 'Try this time.',
            suggestedSlots: [
              {
                start: '2026-06-16T18:00:00.000Z',
                end: '2026-06-16T18:30:00.000Z',
                label: 'Tue, Jun 16, 2:00 PM',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    const onSelectSlot = vi.fn()

    render(
      <BookingAgentPanel
        mode="booking"
        eventTypeId="11111111-1111-4111-8111-111111111111"
        hostUserId="22222222-2222-4222-8222-222222222222"
        timezone="America/New_York"
        holdDisabled
        selectedSlot={null}
        onDraftChange={vi.fn()}
        onSelectSlot={onSelectSlot}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /AI assistant/i }))

    fireEvent.change(screen.getByLabelText('Message the booking assistant'), {
      target: { value: 'Tuesday afternoon' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    const slotButton = await screen.findByRole('button', {
      name: /Tue, Jun 16/,
    })

    expect(slotButton).toHaveProperty('disabled', true)
    fireEvent.click(slotButton)
    expect(onSelectSlot).not.toHaveBeenCalled()
  })

  it('ignores stale assistant responses after booking context changes', async () => {
    const staleRequest = createDeferredResponse()
    let requestCount = 0
    const fetchMock = vi.fn(async () => {
      requestCount += 1

      if (requestCount === 1) {
        return staleRequest.promise
      }

      return new Response(
        JSON.stringify({
          success: true,
          reply: 'Fresh reply',
          suggestedSlots: [
            {
              start: '2026-06-17T18:00:00.000Z',
              end: '2026-06-17T18:30:00.000Z',
              label: 'Wed, Jun 17, 2:00 PM',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const onDraftChange = vi.fn()

    const { rerender } = render(
      <BookingAgentPanel
        mode="booking"
        eventTypeId="11111111-1111-4111-8111-111111111111"
        hostUserId="22222222-2222-4222-8222-222222222222"
        timezone="America/New_York"
        selectedDate="2026-06-16"
        selectedSlot={null}
        onDraftChange={onDraftChange}
        onSelectSlot={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /AI assistant/i }))
    fireEvent.change(screen.getByLabelText('Message the booking assistant'), {
      target: { value: 'Tuesday afternoon' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    rerender(
      <BookingAgentPanel
        mode="booking"
        eventTypeId="11111111-1111-4111-8111-111111111111"
        hostUserId="22222222-2222-4222-8222-222222222222"
        timezone="America/New_York"
        selectedDate="2026-06-17"
        selectedSlot={null}
        onDraftChange={onDraftChange}
        onSelectSlot={vi.fn()}
      />
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /send/i })).toHaveProperty(
        'disabled',
        false
      )
    )
    fireEvent.change(screen.getByLabelText('Message the booking assistant'), {
      target: { value: 'Wednesday afternoon' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await screen.findByText('Fresh reply')
    expect(screen.getByRole('button', { name: /Wed, Jun 17/ })).toBeDefined()

    staleRequest.resolve(
      new Response(
        JSON.stringify({
          success: true,
          reply: 'Stale reply',
          suggestedSlots: [
            {
              start: '2026-06-16T18:00:00.000Z',
              end: '2026-06-16T18:30:00.000Z',
              label: 'Tue, Jun 16, 2:00 PM',
            },
          ],
          draft: {
            guestName: 'Stale Guest',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    await staleRequest.promise
    await Promise.resolve()

    expect(onDraftChange).not.toHaveBeenCalled()
    expect(screen.queryByText('Stale reply')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Tue, Jun 16/ })
    ).toBeNull()
  })

  it('can close the floating assistant panel back to the launcher', () => {
    render(
      <BookingAgentPanel
        mode="booking"
        eventTypeId="11111111-1111-4111-8111-111111111111"
        hostUserId="22222222-2222-4222-8222-222222222222"
        timezone="America/New_York"
        selectedSlot={null}
        onDraftChange={vi.fn()}
        onSelectSlot={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /AI assistant/i }))
    expect(screen.getByText('Booking assistant')).toBeDefined()

    fireEvent.click(
      screen.getByRole('button', { name: 'Close booking assistant' })
    )

    expect(screen.queryByText('Booking assistant')).toBeNull()
    expect(screen.getByRole('button', { name: /AI assistant/i })).toBeDefined()
  })

  it('keeps the assistant in page flow below desktop widths', () => {
    render(
      <BookingAgentPanel
        mode="booking"
        eventTypeId="11111111-1111-4111-8111-111111111111"
        hostUserId="22222222-2222-4222-8222-222222222222"
        timezone="America/New_York"
        selectedSlot={null}
        onDraftChange={vi.fn()}
        onSelectSlot={vi.fn()}
      />
    )

    const launcherWrapper = screen.getByRole('button', {
      name: /AI assistant/i,
    }).parentElement
    const classes = launcherWrapper?.className.split(/\s+/) ?? []

    expect(classes).toContain('mt-6')
    expect(classes).toContain('lg:fixed')
    expect(classes).not.toContain('fixed')
  })
})

function createDeferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((next) => {
    resolve = next
  })

  return { promise, resolve }
}
