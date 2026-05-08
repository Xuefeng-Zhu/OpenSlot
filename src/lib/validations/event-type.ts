import { z } from 'zod'

export const eventTypeSlugSchema = z
  .string()
  .min(1, 'URL slug is required')
  .max(100, 'URL slug must be 100 characters or less')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers, and hyphens'
  )

export const eventTypeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  slug: eventTypeSlugSchema,
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  duration_minutes: z.number().int('Duration must be a whole number').positive('Duration must be positive'),
  buffer_before_minutes: z.number().int('Buffer must be a whole number').nonnegative('Buffer cannot be negative').default(0),
  buffer_after_minutes: z.number().int('Buffer must be a whole number').nonnegative('Buffer cannot be negative').default(0),
  min_notice_minutes: z.number().int('Notice must be a whole number').nonnegative('Notice cannot be negative').default(60),
  max_booking_days_ahead: z.number().int('Max days must be a whole number').positive('Max days must be positive').default(60),
  location_type: z.enum(['online', 'phone', 'in_person', 'custom']),
  location_value: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type EventTypeFormValues = z.infer<typeof eventTypeSchema>
