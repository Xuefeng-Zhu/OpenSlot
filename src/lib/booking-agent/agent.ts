import { addDays, format } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import type { TimeSlot } from '@/lib/availability/types'
import { DEFAULT_TIMEZONE, validTimezoneOrNull } from '@/lib/utils/timezone'
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
const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any'

export interface RunBookingAgentInput {
  request: BookingAgentRequest
  eventContext: BookingAgentEventContext
  provider: BookingAgentProvider
  now?: Date
  loadSlots: (input: {
    date: string
    timezone: string
  }) => Promise<
    | { success: true; slots: TimeSlot[] }
    | { success: false; error: string; status: number }
  >
}

export interface RunBookingAgentFallbackInput {
  request: BookingAgentRequest
  loadSlots: RunBookingAgentInput['loadSlots']
  now?: Date
}

export async function runBookingAgentTurn({
  request,
  eventContext,
  provider,
  now = new Date(),
  loadSlots,
}: RunBookingAgentInput): Promise<BookingAgentResponse> {
  const inferredSearch = inferAvailabilitySearch(request, now)
  const modelContent = await provider.complete({
    messages: buildProviderMessages({
      request,
      eventContext,
      now,
      inferredSearch,
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

  const search =
    action.availabilitySearch ??
    (shouldUseInferredAvailabilitySearch(action, inferredSearch)
      ? inferredSearch
      : null)
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
        ? action.availabilitySearch
          ? action.reply
          : `I checked ${formatSearchDateForReply(
              search.date,
              timezone
            )} and found these ${timeOfDayLabel(
              search.timeOfDay ?? 'any'
            )} openings.`
        : `I checked ${search.date}, but did not find open ${timeOfDayLabel(
            search.timeOfDay ?? 'any'
          )} times. Try another date or a wider time window.`,
    suggestedSlots,
    draft: compactDraft(action.draft),
    nextAction: suggestedSlots.length > 0 ? 'show_slots' : 'ask_preference',
  }
}

/**
 * Provides a narrow deterministic fallback for common slot-search phrases when
 * the model gateway is temporarily unavailable or blocked by billing/config.
 */
export async function runBookingAgentFallbackTurn({
  request,
  loadSlots,
  now = new Date(),
}: RunBookingAgentFallbackInput): Promise<BookingAgentResponse> {
  const search = inferAvailabilitySearch(request, now)

  if (!search) {
    return {
      success: true,
      reply:
        'The AI model is temporarily unavailable, but you can still pick a date below. Tell me a specific day like "next Friday" and I can check openings directly.',
      suggestedSlots: [],
      nextAction: 'ask_preference',
    }
  }

  const slotsResult = await loadSlots({
    date: search.date,
    timezone: search.timezone,
  })

  if (!slotsResult.success) {
    return {
      success: true,
      reply:
        'The AI model is temporarily unavailable, and I could not load openings for that date. Please choose a date from the calendar below.',
      suggestedSlots: [],
      nextAction: 'ask_preference',
    }
  }

  const suggestedSlots = filterByTimeOfDay(
    slotsResult.slots,
    search.timezone,
    search.timeOfDay
  )
    .slice(0, MAX_SUGGESTED_SLOTS)
    .map((slot) => ({
      ...slot,
      label: formatSlotLabel(slot, search.timezone),
    }))

  return {
    success: true,
    reply:
      suggestedSlots.length > 0
        ? `The AI model is temporarily unavailable, but I checked ${formatSearchDateForReply(
            search.date,
            search.timezone
          )} directly and found these openings.`
        : `The AI model is temporarily unavailable. I checked ${formatSearchDateForReply(
            search.date,
            search.timezone
          )}, but did not find open ${timeOfDayLabel(
            search.timeOfDay
          )} times. Try another date or a wider time window.`,
    suggestedSlots,
    nextAction: suggestedSlots.length > 0 ? 'show_slots' : 'ask_preference',
  }
}

function buildProviderMessages({
  request,
  eventContext,
  now,
  inferredSearch,
}: {
  request: BookingAgentRequest
  eventContext: BookingAgentEventContext
  now: Date
  inferredSearch: ReturnType<typeof inferAvailabilitySearch>
}) {
  return [
    {
      role: 'system' as const,
      content: bookingAgentSystemPrompt(
        eventContext,
        request,
        now,
        inferredSearch
      ),
    },
    ...request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ]
}

function bookingAgentSystemPrompt(
  eventContext: BookingAgentEventContext,
  request: BookingAgentRequest,
  now: Date,
  inferredSearch: ReturnType<typeof inferAvailabilitySearch>
) {
  const timezone = normalizeTimezone(request.timezone, request.timezone)
  const zonedNow = toZonedTime(now, timezone)
  const context = {
    mode: request.mode,
    timezone,
    currentLocalDate: format(zonedNow, 'yyyy-MM-dd'),
    currentLocalWeekday: format(zonedNow, 'EEEE'),
    tomorrowLocalDate: format(addDays(zonedNow, 1), 'yyyy-MM-dd'),
    inferredAvailabilitySearch: inferredSearch,
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

When the guest asks for times, set availabilitySearch. Use currentLocalDate, currentLocalWeekday, tomorrowLocalDate, and inferredAvailabilitySearch to resolve relative dates like today, tomorrow, and weekday names. Use the selectedDate if the guest says "that day" or similar. Infer timeOfDay only from explicit hints like morning, afternoon, or evening. If a date is still ambiguous after using context, ask a concise clarifying question and leave availabilitySearch null.

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
  timeOfDay: TimeOfDay
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

function normalizeTimezone(value: string | null | undefined, fallback: string) {
  return (
    validTimezoneOrNull(value) ??
    validTimezoneOrNull(fallback) ??
    DEFAULT_TIMEZONE
  )
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

function timeOfDayLabel(timeOfDay: TimeOfDay) {
  return timeOfDay === 'any' ? 'available' : timeOfDay
}

function shouldUseInferredAvailabilitySearch(
  action: BookingAgentModelAction,
  inferredSearch: ReturnType<typeof inferAvailabilitySearch>
) {
  if (!inferredSearch || action.availabilitySearch) return false
  if (action.nextAction !== 'ask_preference') return false
  return isClarificationStyleReply(action.reply)
}

function isClarificationStyleReply(reply: string) {
  const lowerReply = reply.toLowerCase()
  const asksQuestion =
    reply.includes('?') ||
    /\b(clarify|confirm|which|what|when|specific|mean)\b/.test(lowerReply)
  const referencesDateOrTime =
    /\b(date|day|time|today|tomorrow|morning|afternoon|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      lowerReply
    )

  return asksQuestion && referencesDateOrTime
}

function inferAvailabilitySearch(
  request: BookingAgentRequest,
  now: Date
): { date: string; timezone: string; timeOfDay: TimeOfDay } | null {
  const message = latestUserMessage(request)
  if (!message) return null

  const timezone = normalizeTimezone(request.timezone, request.timezone)
  const lowerMessage = message.toLowerCase()
  const timeOfDay = inferTimeOfDay(lowerMessage)
  const selectedDate = request.clientState?.selectedDate

  if (
    selectedDate &&
    /\b(that|this|selected|same)\s+day\b/.test(lowerMessage)
  ) {
    return { date: selectedDate, timezone, timeOfDay }
  }

  const explicitDate = lowerMessage.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]
  if (explicitDate) return { date: explicitDate, timezone, timeOfDay }

  const zonedNow = toZonedTime(now, timezone)
  if (/\btoday\b/.test(lowerMessage)) {
    return { date: format(zonedNow, 'yyyy-MM-dd'), timezone, timeOfDay }
  }

  if (/\btomorrow\b/.test(lowerMessage)) {
    return {
      date: format(addDays(zonedNow, 1), 'yyyy-MM-dd'),
      timezone,
      timeOfDay,
    }
  }

  for (const [weekday, weekdayIndex] of Object.entries(WEEKDAYS)) {
    if (!new RegExp(`\\b(?:next\\s+)?${weekday}\\b`).test(lowerMessage)) {
      continue
    }

    const daysAhead = daysUntilWeekday(zonedNow.getDay(), weekdayIndex)
    return {
      date: format(addDays(zonedNow, daysAhead), 'yyyy-MM-dd'),
      timezone,
      timeOfDay,
    }
  }

  return null
}

function latestUserMessage(request: BookingAgentRequest) {
  return [...request.messages]
    .reverse()
    .find((message) => message.role === 'user')?.content
}

function inferTimeOfDay(message: string): TimeOfDay {
  if (/\bmorning\b/.test(message)) return 'morning'
  if (/\bafternoon\b/.test(message)) return 'afternoon'
  if (/\b(evening|night)\b/.test(message)) return 'evening'
  return 'any'
}

function daysUntilWeekday(currentWeekday: number, targetWeekday: number) {
  return (targetWeekday - currentWeekday + 7) % 7 || 7
}

function formatSearchDateForReply(date: string, timezone: string) {
  const noon = fromZonedTime(new Date(`${date}T12:00:00`), timezone)

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(noon)
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
