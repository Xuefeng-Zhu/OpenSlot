import type { TimeSlot } from '@/lib/availability/types'
import type {
  BookingAgentEventContext,
  BookingAgentMessage,
  BookingAgentModelAction,
  BookingAgentProvider,
  BookingAgentResponse,
  BookingAgentRequest,
} from './types'
import { bookingAgentModelActionSchema } from './types'

const MAX_SUGGESTED_SLOTS = 6

export interface RunBookingAgentInput {
  request: BookingAgentRequest
  eventContext: BookingAgentEventContext
  provider: BookingAgentProvider
  loadSlots: (input: {
    date: string
    timezone: string
  }) => Promise<
    | { success: true; slots: TimeSlot[] }
    | { success: false; error: string; status: number }
  >
}

export async function runBookingAgentTurn({
  request,
  eventContext,
  provider,
  loadSlots,
}: RunBookingAgentInput): Promise<BookingAgentResponse> {
  const modelContent = await provider.complete({
    messages: buildProviderMessages({
      request,
      eventContext,
    }),
  })
  const action = parseModelAction(modelContent)

  if (!action) {
    return {
      success: true,
      reply:
        'I had trouble reading that. Tell me the day and rough time that works for you, and I can look for openings.',
      suggestedSlots: [],
      nextAction: 'ask_preference',
    }
  }

  const search = action.availabilitySearch
  if (!search) {
    return {
      success: true,
      reply: action.reply,
      suggestedSlots: [],
      draft: compactDraft(action.draft),
      nextAction: action.nextAction,
    }
  }

  const timezone = normalizeTimezone(search.timezone ?? request.timezone, request.timezone)
  const slotsResult = await loadSlots({
    date: search.date,
    timezone,
  })

  if (!slotsResult.success) {
    return {
      success: true,
      reply:
        slotsResult.error ||
        'I could not load available times right now. Please try another date.',
      suggestedSlots: [],
      draft: compactDraft(action.draft),
      nextAction: 'ask_preference',
    }
  }

  const suggestedSlots = filterByTimeOfDay(
    slotsResult.slots,
    timezone,
    search.timeOfDay ?? 'any'
  )
    .slice(0, MAX_SUGGESTED_SLOTS)
    .map((slot) => ({
      ...slot,
      label: formatSlotLabel(slot, timezone),
    }))

  return {
    success: true,
    reply:
      suggestedSlots.length > 0
        ? action.reply
        : `I checked ${search.date}, but did not find open ${timeOfDayLabel(
            search.timeOfDay ?? 'any'
          )} times. Try another date or a wider time window.`,
    suggestedSlots,
    draft: compactDraft(action.draft),
    nextAction: suggestedSlots.length > 0 ? 'show_slots' : 'ask_preference',
  }
}

function buildProviderMessages({
  request,
  eventContext,
}: {
  request: BookingAgentRequest
  eventContext: BookingAgentEventContext
}) {
  return [
    {
      role: 'system' as const,
      content: bookingAgentSystemPrompt(eventContext, request),
    },
    ...request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ]
}

function bookingAgentSystemPrompt(
  eventContext: BookingAgentEventContext,
  request: BookingAgentRequest
) {
  const context = {
    mode: request.mode,
    timezone: request.timezone,
    selectedDate: request.clientState?.selectedDate ?? null,
    selectedSlot: request.clientState?.selectedSlot ?? null,
    event: {
      title: eventContext.eventTitle,
      description: eventContext.eventDescription ?? '',
      hostName: eventContext.hostName,
      durationMinutes: eventContext.durationMinutes,
      locationType: eventContext.locationType,
      locationValue: eventContext.locationValue ?? null,
      inviteeQuestions: eventContext.inviteeQuestions,
    },
  }

  return `You help guests book an OpenSlot meeting. You are not allowed to confirm bookings, cancel bookings, or ask for private host data.

Return only valid JSON with this shape:
{
  "reply": "short guest-facing message",
  "availabilitySearch": {"date":"YYYY-MM-DD","timezone":"IANA timezone","timeOfDay":"morning|afternoon|evening|any"} or null,
  "draft": {"guestName":"optional","guestEmail":"optional","guestTimezone":"optional","notes":"optional","answers":{"questionId":"optional answer"}} or null,
  "nextAction": "ask_preference|show_slots|choose_slot|complete_form"
}

When the guest asks for times, set availabilitySearch. Use the selectedDate if the guest says "that day" or similar. Infer timeOfDay only from explicit hints like morning, afternoon, or evening. If a date is ambiguous, ask a concise clarifying question and leave availabilitySearch null.

If the guest provides name, email, timezone, notes, or answers to invitee questions, include them in draft. Do not include reschedule tokens, cancellation tokens, or any credentials.

Context:
${JSON.stringify(context)}`
}

export function parseModelAction(content: string): BookingAgentModelAction | null {
  const jsonText = extractJsonObject(content)
  if (!jsonText) return null

  const parsed = safeJsonParse(jsonText)
  if (!parsed) return null

  const result = bookingAgentModelActionSchema.safeParse(parsed)
  return result.success ? result.data : null
}

function extractJsonObject(content: string): string | null {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const candidate = fenced[1].trim()
    if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace <= firstBrace) return null

  return trimmed.slice(firstBrace, lastBrace + 1)
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function filterByTimeOfDay(
  slots: TimeSlot[],
  timezone: string,
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'any'
) {
  if (timeOfDay === 'any') return slots

  return slots.filter((slot) => {
    const hour = hourInTimezone(slot.start, timezone)
    if (timeOfDay === 'morning') return hour >= 6 && hour < 12
    if (timeOfDay === 'afternoon') return hour >= 12 && hour < 17
    return hour >= 17 && hour < 22
  })
}

function hourInTimezone(isoString: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(new Date(isoString))

  const value = parts.find((part) => part.type === 'hour')?.value ?? '0'
  return Number(value) % 24
}

function normalizeTimezone(value: string, fallback: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return fallback
  }
}

function formatSlotLabel(slot: TimeSlot, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  })

  return formatter.format(new Date(slot.start))
}

function timeOfDayLabel(timeOfDay: 'morning' | 'afternoon' | 'evening' | 'any') {
  return timeOfDay === 'any' ? 'available' : timeOfDay
}

function compactDraft(draft: BookingAgentModelAction['draft']) {
  if (!draft) return undefined

  const compacted = Object.fromEntries(
    Object.entries(draft).filter(([, value]) => {
      if (value === undefined || value === null) return false
      if (typeof value === 'string') return value.trim().length > 0
      if (typeof value === 'object') return Object.keys(value).length > 0
      return true
    })
  )

  return Object.keys(compacted).length > 0
    ? (compacted as NonNullable<BookingAgentModelAction['draft']>)
    : undefined
}
