import { z } from 'zod'
import { isValidTimezone } from '@/lib/validations/profile'

/**
 * Settings payload shared by the dashboard form and PATCH /api/settings.
 * Auth-sensitive changes like password updates stay outside this schema and go
 * through Butterbase Auth directly.
 */
export const settingsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  email: z.string().email('Must be a valid email address').max(320, 'Email must be 320 characters or less'),
  defaultTimezone: z
    .string()
    .refine(isValidTimezone, { message: 'Please select a valid timezone' }),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
  timeFormat: z.enum(['12h', '24h']),
  notifyNewBooking: z.boolean(),
  notifyCancellation: z.boolean(),
  notifyReminder: z.boolean(),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>
