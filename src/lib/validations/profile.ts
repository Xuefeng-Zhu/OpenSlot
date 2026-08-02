import { z } from 'zod'

export { getTimezones, isValidTimezone } from '@/lib/utils/timezone'

/**
 * Dashboard profile form schema for public host identity.
 */
export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Username can only contain lowercase letters, numbers, and hyphens'
    ),
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
