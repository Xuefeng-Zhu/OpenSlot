import { z, type ZodError } from 'zod'

import type { Json } from '@/lib/types/database'

export interface ReminderOutboxChannels {
  [key: string]: Json | undefined
  guest: boolean
  host: boolean
}

export interface ReminderOutboxPayload {
  [key: string]: Json | undefined
  bookingId: string
  eventTypeId: string
  hostUserId: string
  startAt: string
  endAt: string
  reminderMinutesBefore: number
  channels: ReminderOutboxChannels
}

export interface BuildReminderOutboxPayloadInput {
  bookingId: string
  eventTypeId: string
  hostUserId: string
  startAt: string
  endAt: string
  reminderMinutesBefore: number
  channels: ReminderOutboxChannels
}

export const reminderOutboxPayloadSchema = z
  .object({
    bookingId: z.string().min(1, 'Booking id is required'),
    eventTypeId: z.string().min(1, 'Event type id is required'),
    hostUserId: z.string().min(1, 'Host user id is required'),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    reminderMinutesBefore: z
      .number()
      .int('Reminder lead time must be a whole number')
      .min(5, 'Reminder lead time must be at least 5 minutes')
      .max(10080, 'Reminder lead time must be 7 days or less'),
    channels: z
      .object({
        guest: z.boolean(),
        host: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (!payload.channels.guest && !payload.channels.host) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one reminder channel must be enabled',
        path: ['channels'],
      })
    }
  })

export function buildReminderOutboxPayload(
  input: BuildReminderOutboxPayloadInput
): ReminderOutboxPayload {
  return parseReminderOutboxPayload(input)
}

export function parseReminderOutboxPayload(payload: unknown): ReminderOutboxPayload {
  const parsed = reminderOutboxPayloadSchema.safeParse(payload)

  if (!parsed.success) {
    throw new Error(
      `Outbox event payload is invalid reminder data: ${formatReminderPayloadIssues(
        parsed.error
      )}`
    )
  }

  return parsed.data as ReminderOutboxPayload
}

export function formatReminderPayloadIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.') || 'payload'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}
