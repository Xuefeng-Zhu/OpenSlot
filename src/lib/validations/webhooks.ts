import { z } from 'zod'

export const webhookEventTypes = [
  '*',
  'booking.confirmed',
  'booking.cancelled',
  'booking.rescheduled',
] as const

export const webhookEndpointSchema = z.object({
  url: z
    .string()
    .url('Webhook URL must be a valid URL')
    .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
      message: 'Webhook URL must use HTTP or HTTPS',
    }),
  description: z.string().max(200, 'Description must be 200 characters or less').optional(),
  subscribedEvents: z
    .array(z.enum(webhookEventTypes))
    .min(1, 'Select at least one webhook event')
    .max(20, 'Too many webhook events'),
})

export const updateWebhookEndpointSchema = webhookEndpointSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export type WebhookEndpointInput = z.infer<typeof webhookEndpointSchema>
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>
