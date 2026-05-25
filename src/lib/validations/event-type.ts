import { z } from 'zod'
import { videoProviders, type VideoProvider } from '@/lib/calendar/video-providers'
import { inviteeQuestionConfigSchema } from './invitee-questions'

export { videoProviders, type VideoProvider }

export const eventLocationTypes = [
  'online',
  'phone',
  'in_person',
  'custom',
  'video_provider',
] as const

export type EventLocationType = (typeof eventLocationTypes)[number]

/**
 * URL-safe slug contract for event type public booking links.
 */
export const eventTypeSlugSchema = z
  .string()
  .min(1, 'URL slug is required')
  .max(100, 'URL slug must be 100 characters or less')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers, and hyphens'
  )

/**
 * Shared create/edit schema for dashboard event type forms and API routes.
 * Defaults mirror the database-backed MVP scheduling constraints.
 */
export const eventTypeFieldsSchema = z.object({
  schedule_id: z.string().uuid('Choose an availability schedule'),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  slug: eventTypeSlugSchema,
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  duration_minutes: z.number().int('Duration must be a whole number').positive('Duration must be positive'),
  buffer_before_minutes: z.number().int('Buffer must be a whole number').nonnegative('Buffer cannot be negative').default(0),
  buffer_after_minutes: z.number().int('Buffer must be a whole number').nonnegative('Buffer cannot be negative').default(0),
  min_notice_minutes: z.number().int('Notice must be a whole number').nonnegative('Notice cannot be negative').default(60),
  max_booking_days_ahead: z.number().int('Max days must be a whole number').positive('Max days must be positive').default(60),
  location_type: z.enum(eventLocationTypes),
  location_value: z.string().max(500, 'Location details must be 500 characters or less').optional(),
  video_provider: z.enum(videoProviders).nullable().optional(),
  invitee_questions: inviteeQuestionConfigSchema.default([]),
  is_active: z.boolean().default(true),
  reminder_enabled: z.boolean().default(false),
  reminder_minutes_before: z
    .number()
    .int('Reminder timing must be a whole number')
    .min(5, 'Reminder must be at least 5 minutes before the meeting')
    .max(10080, 'Reminder must be 7 days or less before the meeting')
    .default(1440),
  reminder_guest_enabled: z.boolean().default(true),
  reminder_host_enabled: z.boolean().default(true),
})

export const eventTypeSchema = eventTypeFieldsSchema
  .superRefine((data, ctx) => {
    if (data.location_type === 'video_provider') {
      if (!data.video_provider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose a video provider',
          path: ['video_provider'],
        })
      }
    } else {
      if (data.video_provider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Video provider is only available for generated video locations',
          path: ['video_provider'],
        })
      }

      if (!data.location_value?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Location details are required',
          path: ['location_value'],
        })
      }
    }

    if (
      data.reminder_enabled &&
      !data.reminder_guest_enabled &&
      !data.reminder_host_enabled
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one reminder recipient',
        path: ['reminder_guest_enabled'],
      })
    }
  })

export type EventTypeFormValues = z.infer<typeof eventTypeSchema>

/**
 * Parses event type values with cross-field location and reminder policy
 * validation.
 */
export function parseEventTypeValues(body: unknown) {
  return eventTypeSchema.safeParse(body)
}
