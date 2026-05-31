import { z } from 'zod'
import { webhookEventTypes } from '@/lib/webhooks/event-types'

export { webhookEventTypes } from '@/lib/webhooks/event-types'

const webhookDescriptionSchema = z
  .string()
  .max(200, 'Description must be 200 characters or less')

/**
 * Rejects webhook URLs that resolve to private, loopback, or link-local
 * addresses to prevent SSRF attacks against internal infrastructure.
 */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fd[0-9a-f]{2}:/i,
  /^\[?fc[0-9a-f]{2}:/i,
  /^metadata\.google\.internal$/i,
]

function isBlockedWebhookHost(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
    return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))
  } catch {
    return true
  }
}

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
    })
    .refine((value) => !isBlockedWebhookHost(value), {
      message:
        'Webhook URL must not point to a private, loopback, or link-local address',
    }),
  description: webhookDescriptionSchema.optional(),
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
    description: webhookDescriptionSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export type WebhookEndpointInput = z.infer<typeof webhookEndpointSchema>
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>
