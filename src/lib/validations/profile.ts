import { z } from 'zod'

/**
 * Checks if a timezone string is a valid IANA timezone identifier.
 */
export function isValidTimezone(timezone: string): boolean {
  if (timezone === 'UTC') {
    return true
  }

  try {
    const validTimezones = Intl.supportedValuesOf('timeZone')
    return validTimezones.includes(timezone)
  } catch {
    // Fallback for environments that don't support Intl.supportedValuesOf
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Returns a list of all valid IANA timezone identifiers.
 */
export function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    // Fallback: return common timezones
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Toronto',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Pacific/Auckland',
    ]
  }
}

/**
 * Dashboard profile form schema for public identity and default timezone.
 */
export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Username can only contain lowercase letters, numbers, and hyphens'
    ),
  default_timezone: z
    .string()
    .refine(isValidTimezone, { message: 'Please select a valid timezone' }),
  public_headline: z
    .string()
    .max(80, 'Headline must be 80 characters or less')
    .optional(),
  public_bio: z
    .string()
    .max(280, 'Bio must be 280 characters or less')
    .optional(),
  response_time_label: z
    .string()
    .max(80, 'Response time must be 80 characters or less')
    .optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>
