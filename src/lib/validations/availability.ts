import { z } from 'zod'
import { isValidTimezone } from '@/lib/validations/profile'

const timeStringSchema = z.string().regex(
  /^\d{2}:\d{2}(?::\d{2})?$/,
  'Start time must be in HH:MM format'
)

const endTimeStringSchema = z.string().regex(
  /^\d{2}:\d{2}(?::\d{2})?$/,
  'End time must be in HH:MM format'
)

/**
 * Schema for a single availability rule (standalone validation with timezone and time range check).
 * Exported for use in tests and direct rule validation.
 */
export const availabilityRuleSchema = z.object({
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(0).max(6),
  start_time: timeStringSchema,
  end_time: endTimeStringSchema,
  timezone: z.string().refine(isValidTimezone, { message: 'Must be a valid IANA timezone' }).optional(),
  is_active: z.boolean(),
}).refine(
  (data) => data.start_time < data.end_time,
  { message: 'Start time must be before end time', path: ['start_time'] }
)

/**
 * Schema for a single availability rule in the batch save request (no timezone field, no time range check at rule level).
 */
const saveAvailabilityRuleSchema = z.object({
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(0).max(6),
  start_time: timeStringSchema,
  end_time: endTimeStringSchema,
  is_active: z.boolean(),
})

/**
 * Schema for a single availability override in the save request.
 */
const availabilityOverrideSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  start_time: timeStringSchema.nullable(),
  end_time: endTimeStringSchema.nullable(),
  is_available: z.boolean(),
  reason: z.string().max(500).nullable().optional(),
})

/**
 * Schema for the batch save availability request.
 * Used by POST /api/availability to validate the request body.
 */
export const saveAvailabilitySchema = z.object({
  rules: z.array(saveAvailabilityRuleSchema),
  overrides: z.array(availabilityOverrideSchema),
  deletedRuleIds: z.array(z.string().uuid()),
  deletedOverrideIds: z.array(z.string().uuid()),
  timezone: z.string().refine(isValidTimezone, { message: 'Must be a valid IANA timezone' }),
})

export type SaveAvailabilityInput = z.infer<typeof saveAvailabilitySchema>
