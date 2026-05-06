import { z } from 'zod'
import { isValidTimezone } from './profile'

/**
 * Validates a time string in HH:mm format.
 */
function isValidTimeString(time: string): boolean {
  const match = time.match(/^(\d{2}):(\d{2})$/)
  if (!match) return false
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/**
 * Validates a date string in YYYY-MM-DD format.
 */
function isValidDateString(date: string): boolean {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  // Basic validation — check the date is actually valid
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

/**
 * Schema for a single availability rule (weekly recurring).
 */
export const availabilityRuleSchema = z
  .object({
    weekday: z
      .number()
      .int('Weekday must be a whole number')
      .min(0, 'Weekday must be between 0 (Sunday) and 6 (Saturday)')
      .max(6, 'Weekday must be between 0 (Sunday) and 6 (Saturday)'),
    start_time: z
      .string()
      .refine(isValidTimeString, { message: 'Start time must be in HH:mm format' }),
    end_time: z
      .string()
      .refine(isValidTimeString, { message: 'End time must be in HH:mm format' }),
    timezone: z
      .string()
      .refine(isValidTimezone, { message: 'Please select a valid timezone' }),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => data.start_time < data.end_time,
    { message: 'Start time must be before end time', path: ['end_time'] }
  )

/**
 * Schema for a date-specific availability override.
 */
export const availabilityOverrideSchema = z
  .object({
    date: z
      .string()
      .refine(isValidDateString, { message: 'Date must be in YYYY-MM-DD format' }),
    start_time: z
      .string()
      .refine((val) => val === '' || isValidTimeString(val), {
        message: 'Start time must be in HH:mm format',
      })
      .optional()
      .nullable(),
    end_time: z
      .string()
      .refine((val) => val === '' || isValidTimeString(val), {
        message: 'End time must be in HH:mm format',
      })
      .optional()
      .nullable(),
    timezone: z
      .string()
      .refine(isValidTimezone, { message: 'Please select a valid timezone' }),
    is_available: z.boolean().default(true),
    reason: z.string().max(200, 'Reason must be 200 characters or less').optional().nullable(),
  })
  .refine(
    (data) => {
      // When marking as available, start_time and end_time are required
      if (data.is_available) {
        return (
          data.start_time != null &&
          data.start_time !== '' &&
          data.end_time != null &&
          data.end_time !== ''
        )
      }
      return true
    },
    {
      message: 'Start time and end time are required when marking as available',
      path: ['start_time'],
    }
  )
  .refine(
    (data) => {
      // When available with times, start must be before end
      if (
        data.is_available &&
        data.start_time &&
        data.end_time &&
        data.start_time !== '' &&
        data.end_time !== ''
      ) {
        return data.start_time < data.end_time
      }
      return true
    },
    { message: 'Start time must be before end time', path: ['end_time'] }
  )

export type AvailabilityRuleFormValues = z.infer<typeof availabilityRuleSchema>
export type AvailabilityOverrideFormValues = z.infer<typeof availabilityOverrideSchema>

export { isValidTimeString, isValidDateString }
