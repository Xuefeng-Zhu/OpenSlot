import { z } from 'zod'
import { isValidTimezone } from '@/lib/validations/profile'
import { generateSlug } from '@/lib/utils/slug'

const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')

const intervalSchema = z
  .object({
    start: timeSchema,
    end: timeSchema,
  })
  .refine((interval) => interval.end > interval.start, {
    message: 'End time must be after start time',
    path: ['end'],
  })

const dayAvailabilitySchema = z
  .object({
    enabled: z.boolean(),
    intervals: z.array(intervalSchema),
  })
  .refine((day) => !day.enabled || day.intervals.length > 0, {
    message: 'Enabled days need at least one interval',
    path: ['intervals'],
  })

const availabilitySchema = z.object({
  monday: dayAvailabilitySchema,
  tuesday: dayAvailabilitySchema,
  wednesday: dayAvailabilitySchema,
  thursday: dayAvailabilitySchema,
  friday: dayAvailabilitySchema,
  saturday: dayAvailabilitySchema,
  sunday: dayAvailabilitySchema,
})

export const onboardingSchema = z
  .object({
    profile: z.object({
      displayName: z
        .string()
        .trim()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less'),
      username: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be 30 characters or less')
        .regex(
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
          'Username can only contain lowercase letters, numbers, and hyphens'
        ),
    }),
    availability: availabilitySchema,
    eventType: z.object({
      title: z
        .string()
        .trim()
        .min(1, 'Title is required')
        .max(100, 'Title must be 100 characters or less'),
      duration: z
        .string()
        .regex(/^\d+$/, 'Duration must be a whole number')
        .transform(Number)
        .pipe(
          z
            .number()
            .int('Duration must be a whole number')
            .positive('Duration must be positive')
        ),
      location: z
        .string()
        .trim()
        .min(1, 'Location is required')
        .max(200, 'Location must be 200 characters or less'),
    }),
    timezone: z
      .string()
      .refine(isValidTimezone, { message: 'Please select a valid timezone' }),
  })
  .refine(
    (data) =>
      Object.values(data.availability).some(
        (day) => day.enabled && day.intervals.length > 0
      ),
    {
      message: 'Set at least one available time before continuing.',
      path: ['availability'],
    }
  )

export type OnboardingInput = z.input<typeof onboardingSchema>
export type OnboardingData = z.output<typeof onboardingSchema>

const WEEKDAY_BY_DAY: Record<keyof OnboardingData['availability'], number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/**
 * Converts the onboarding availability form into availability rule insert rows.
 * Disabled days are omitted and enabled days may produce multiple intervals for
 * the same weekday.
 */
export function buildOnboardingAvailabilityRules(
  availability: OnboardingData['availability']
) {
  return Object.entries(availability).flatMap(([day, value]) => {
    if (!value.enabled) return []

    return value.intervals.map((interval) => ({
      weekday: WEEKDAY_BY_DAY[day as keyof OnboardingData['availability']],
      start_time: interval.start,
      end_time: interval.end,
      is_active: true,
    }))
  })
}

export function buildOnboardingEventSlug(title: string) {
  return generateSlug(title)
}
