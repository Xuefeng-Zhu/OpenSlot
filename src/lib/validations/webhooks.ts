import { z } from 'zod'
import { webhookEventTypes } from '@/lib/webhooks/event-types'

export { webhookEventTypes } from '@/lib/webhooks/event-types'

/**
 * Create schema for webhook endpoints managed from settings.
 * The endpoint secret is generated server-side and is intentionally not accepted
 * from the client payload.
 */
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

/**
 * Partial update schema for webhook endpoints.
 * Requires at least one field so empty PATCH requests cannot be treated as
 * successful no-op writes.
 */
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
