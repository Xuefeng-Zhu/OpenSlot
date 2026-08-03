import { z } from 'zod'
import { webhookEventTypes } from '@/lib/webhooks/event-types'

export { webhookEventTypes } from '@/lib/webhooks/event-types'

const webhookDescriptionSchema = z
  .string()
  .max(200, 'Description must be 200 characters or less')

function isBlockedIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number)
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false
  }

  const [first, second] = octets
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

function parseIpv6(hostname: string): number[] | null {
  const pieces = hostname.split('::')
  if (pieces.length > 2) return null

  const left = pieces[0] ? pieces[0].split(':') : []
  const right = pieces[1] ? pieces[1].split(':') : []
  const missing = 8 - left.length - right.length
  if ((pieces.length === 1 && missing !== 0) || missing < 0) return null

  const hextets = [
    ...left,
    ...Array.from({ length: missing }, () => '0'),
    ...right,
  ].map((piece) => Number.parseInt(piece, 16))

  if (
    hextets.length !== 8 ||
    hextets.some(
      (piece) => !Number.isInteger(piece) || piece < 0 || piece > 0xffff
    )
  ) {
    return null
  }

  return hextets
}

function isBlockedIpv6(hostname: string): boolean {
  const hextets = parseIpv6(hostname)
  if (!hextets) return false

  const [first] = hextets
  const isUnspecified = hextets.every((piece) => piece === 0)
  const isLoopback =
    hextets.slice(0, 7).every((piece) => piece === 0) && hextets[7] === 1
  const isUniqueLocal = (first & 0xfe00) === 0xfc00
  const isLinkLocal = (first & 0xffc0) === 0xfe80
  const isSiteLocal = (first & 0xffc0) === 0xfec0
  const isMulticast = (first & 0xff00) === 0xff00
  const isIpv4Mapped =
    hextets.slice(0, 5).every((piece) => piece === 0) &&
    hextets[5] === 0xffff
  const isIpv4Compatible = hextets.slice(0, 6).every((piece) => piece === 0)

  if (isIpv4Mapped || isIpv4Compatible) {
    const ipv4 = [
      hextets[6] >> 8,
      hextets[6] & 0xff,
      hextets[7] >> 8,
      hextets[7] & 0xff,
    ].join('.')
    if (isBlockedIpv4(ipv4)) return true
  }

  return (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isSiteLocal ||
    isMulticast
  )
}

/**
 * Returns whether a webhook URL is safe to send from the worker. The URL parser
 * canonicalizes alternate IPv4 forms; hostname normalization additionally
 * covers trailing-dot hostnames and IPv4-mapped IPv6 literals.
 */
export function isSafeWebhookUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

    const hostname = parsed.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.+$/, '')
      .toLowerCase()

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === 'metadata.google.internal'
    ) {
      return false
    }

    return !isBlockedIpv4(hostname) && !isBlockedIpv6(hostname)
  } catch {
    return false
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
    .refine(isSafeWebhookUrl, {
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
