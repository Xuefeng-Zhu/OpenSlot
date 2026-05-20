import { describe, expect, it, vi } from 'vitest'
import {
  parseModelAction,
  runBookingAgentFallbackTurn,
  runBookingAgentTurn,
} from '../agent'
import type { BookingAgentEventContext, BookingAgentRequest } from '../types'

const request: BookingAgentRequest = {
  mode: 'booking',
  eventTypeId: '11111111-1111-4111-8111-111111111111',
  hostUserId: '22222222-2222-4222-8222-222222222222',
  timezone: 'America/New_York',
  messages: [{ role: 'user', content: 'Next Tuesday afternoon' }],
}

const eventContext: BookingAgentEventContext = {
  eventTypeId: request.eventTypeId,
  hostUserId: request.hostUserId,
  hostName: 'Sarah Chen',
  eventTitle: 'Discovery Call',
  eventDescription: 'Intro call',
  durationMinutes: 30,
  locationType: 'video',
  locationValue: null,
  inviteeQuestions: [],
}

describe('booking agent orchestration', () => {
  it('parses fenced JSON actions from gateway responses', () => {
    expect(
      parseModelAction(
        '```json\n{"reply":"Sure","availabilitySearch":null,"nextAction":"ask_preference"}\n```'
      )
    ).toMatchObject({
      reply: 'Sure',
      availabilitySearch: null,
      nextAction: 'ask_preference',
    })
  })

  it('recovers from malformed model JSON', async () => {
    const result = await runBookingAgentTurn({
      request,
      eventContext,
      provider: {
        complete: vi.fn(async () => 'not-json'),
      },
      loadSlots: vi.fn(),
    })

    expect(result.success).toBe(true)
    expect(result.suggestedSlots).toEqual([])
    expect(result.reply).toContain('trouble')
  })

  it('loads and filters availability when the model asks for slots', async () => {
    const loadSlots = vi.fn(async () => ({
      success: true as const,
      slots: [
        {
          start: '2026-06-16T13:00:00.000Z',
          end: '2026-06-16T13:30:00.000Z',
        },
        {
          start: '2026-06-16T18:00:00.000Z',
          end: '2026-06-16T18:30:00.000Z',
        },
      ],
    }))

    const result = await runBookingAgentTurn({
      request,
      eventContext,
      provider: {
        complete: vi.fn(async () =>
          JSON.stringify({
            reply: 'I found these afternoon options.',
            availabilitySearch: {
              date: '2026-06-16',
              timezone: 'America/New_York',
              timeOfDay: 'afternoon',
            },
            draft: {
              guestName: 'Jane',
              guestEmail: 'jane@example.com',
            },
            nextAction: 'show_slots',
          })
        ),
      },
      loadSlots,
    })

    expect(loadSlots).toHaveBeenCalledWith({
      date: '2026-06-16',
      timezone: 'America/New_York',
    })
    expect(result.suggestedSlots).toEqual([
      {
        start: '2026-06-16T18:00:00.000Z',
        end: '2026-06-16T18:30:00.000Z',
        label: expect.any(String),
      },
    ])
    expect(result.draft).toMatchObject({
      guestName: 'Jane',
      guestEmail: 'jane@example.com',
    })
  })

  it('does not send reschedule tokens to the model prompt', async () => {
    const provider = {
      complete: vi.fn(async (_input: unknown) =>
        JSON.stringify({
          reply: 'What day works?',
          availabilitySearch: null,
          nextAction: 'ask_preference',
        })
      ),
    }

    await runBookingAgentTurn({
      request: {
        ...request,
        mode: 'reschedule',
        rescheduleToken: '33333333-3333-4333-8333-333333333333',
      },
      eventContext,
      provider,
      loadSlots: vi.fn(),
    })

    const call = provider.complete.mock.calls[0]
    expect(call).toBeDefined()
    const prompt = (call![0] as { messages: Array<{ content: string }> }).messages
      .map((message) => message.content)
      .join('\n')

    expect(prompt).not.toContain('33333333-3333-4333-8333-333333333333')
  })

  it('falls back to deterministic availability for common date phrases', async () => {
    const loadSlots = vi.fn(async () => ({
      success: true as const,
      slots: [
        {
          start: '2026-05-22T16:00:00.000Z',
          end: '2026-05-22T16:30:00.000Z',
        },
      ],
    }))

    const result = await runBookingAgentFallbackTurn({
      request: {
        ...request,
        timezone: 'America/Los_Angeles',
        messages: [{ role: 'user', content: 'Find a time next Friday' }],
      },
      loadSlots,
      now: new Date('2026-05-20T17:00:00.000Z'),
    })

    expect(loadSlots).toHaveBeenCalledWith({
      date: '2026-05-22',
      timezone: 'America/Los_Angeles',
    })
    expect(result.success).toBe(true)
    expect(result.reply).toContain('temporarily unavailable')
    expect(result.suggestedSlots).toEqual([
      {
        start: '2026-05-22T16:00:00.000Z',
        end: '2026-05-22T16:30:00.000Z',
        label: expect.any(String),
      },
    ])
  })
})
