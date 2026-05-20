import { z } from 'zod'

export const DEFAULT_BOOKING_AGENT_MODEL = 'deepseek/deepseek-v4-flash'

export const bookingAgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1200),
})

export const bookingAgentSlotSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  label: z.string().min(1).max(120).optional(),
})

export const bookingAgentDraftSchema = z
  .object({
    guestName: z.string().trim().min(1).max(100).optional(),
    guestEmail: z.string().trim().email().optional(),
    guestTimezone: z.string().trim().min(1).max(100).optional(),
    notes: z.string().trim().max(1000).optional(),
    answers: z.record(z.string(), z.union([z.string().max(1000), z.boolean()])).optional(),
  })
  .partial()

export const bookingAgentClientStateSchema = z.object({
  selectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  selectedSlot: bookingAgentSlotSchema.omit({ label: true }).optional(),
})

export const bookingAgentRequestSchema = z.object({
  mode: z.enum(['booking', 'reschedule']),
  eventTypeId: z.string().uuid('Event type ID must be a valid UUID'),
  hostUserId: z.string().uuid('Host user ID must be a valid UUID'),
  rescheduleToken: z.string().uuid('Reschedule token must be a valid UUID').optional(),
  timezone: z.string().trim().min(1).max(100),
  messages: z.array(bookingAgentMessageSchema).min(1).max(10),
  clientState: bookingAgentClientStateSchema.optional(),
})

export const bookingAgentModelActionSchema = z.object({
  reply: z.string().trim().min(1).max(1200),
  availabilitySearch: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      timezone: z.string().trim().min(1).max(100).optional(),
      timeOfDay: z
        .enum(['morning', 'afternoon', 'evening', 'any'])
        .optional()
        .default('any'),
    })
    .nullable()
    .optional(),
  draft: bookingAgentDraftSchema.nullable().optional(),
  nextAction: z
    .enum(['ask_preference', 'show_slots', 'choose_slot', 'complete_form'])
    .optional()
    .default('ask_preference'),
})

export type BookingAgentMessage = z.infer<typeof bookingAgentMessageSchema>
export type BookingAgentRequest = z.infer<typeof bookingAgentRequestSchema>
export type BookingAgentDraft = z.infer<typeof bookingAgentDraftSchema>
export type BookingAgentModelAction = z.infer<
  typeof bookingAgentModelActionSchema
>

export interface BookingAgentEventContext {
  eventTypeId: string
  hostUserId: string
  hostName: string
  eventTitle: string
  eventDescription?: string | null
  durationMinutes: number
  locationType: string
  locationValue?: string | null
  inviteeQuestions: Array<{
    id: string
    label: string
    type: string
    required: boolean
    options: string[]
  }>
}

export interface BookingAgentResponse {
  success: true
  reply: string
  suggestedSlots: Array<z.infer<typeof bookingAgentSlotSchema>>
  draft?: BookingAgentDraft
  nextAction: NonNullable<BookingAgentModelAction['nextAction']>
}

export interface BookingAgentProviderInput {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
}

export interface BookingAgentProvider {
  complete(input: BookingAgentProviderInput): Promise<string>
}
