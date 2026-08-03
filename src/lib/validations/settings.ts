import { z } from 'zod'
import { isValidTimezone } from '@/lib/validations/profile'

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address')
  .max(320, 'Email must be 320 characters or less')

/** Account-owned settings accepted by PATCH /api/settings. */
export const accountSettingsPatchSchema = z
  .object({
    section: z.literal('account'),
    email: emailSchema,
  })
  .strict()

/** Display preferences accepted by PATCH /api/settings. */
export const preferencesSettingsPatchSchema = z
  .object({
    section: z.literal('preferences'),
    defaultTimezone: z
      .string()
      .refine(isValidTimezone, { message: 'Please select a valid timezone' }),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
    timeFormat: z.enum(['12h', '24h']),
  })
  .strict()

/** Host notification preferences accepted by PATCH /api/settings. */
export const notificationsSettingsPatchSchema = z
  .object({
    section: z.literal('notifications'),
    notifyNewBooking: z.boolean(),
    notifyCancellation: z.boolean(),
    notifyReminder: z.boolean(),
  })
  .strict()

/**
 * Section-discriminated settings payload. Strict section schemas ensure that a
 * tab can never persist drafts owned by another tab.
 */
export const settingsPatchSchema = z.discriminatedUnion('section', [
  accountSettingsPatchSchema,
  preferencesSettingsPatchSchema,
  notificationsSettingsPatchSchema,
])

export type SettingsPatch = z.infer<typeof settingsPatchSchema>
export type AccountSettingsPatch = z.infer<typeof accountSettingsPatchSchema>
export type PreferencesSettingsPatch = z.infer<
  typeof preferencesSettingsPatchSchema
>
export type NotificationsSettingsPatch = z.infer<
  typeof notificationsSettingsPatchSchema
>

export const settingsTabs = [
  'account',
  'preferences',
  'notifications',
  'integrations',
] as const

export type SettingsTab = (typeof settingsTabs)[number]

/** Server-loaded values used to initialize the three settings sections. */
export interface SettingsFormValues {
  email: string
  defaultTimezone: PreferencesSettingsPatch['defaultTimezone']
  dateFormat: PreferencesSettingsPatch['dateFormat']
  timeFormat: PreferencesSettingsPatch['timeFormat']
  notifyNewBooking: boolean
  notifyCancellation: boolean
  notifyReminder: boolean
}

/** Detects the retired all-sections payload so callers can require a reload. */
export function isLegacyFullSettingsPayload(
  value: unknown
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const payload = value as Record<string, unknown>
  return (
    !('section' in payload) &&
    'email' in payload &&
    'defaultTimezone' in payload &&
    'dateFormat' in payload &&
    'timeFormat' in payload &&
    'notifyNewBooking' in payload &&
    'notifyCancellation' in payload &&
    'notifyReminder' in payload
  )
}
