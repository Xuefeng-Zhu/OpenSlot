import { describe, expect, it } from 'vitest'
import {
  isSafeWebhookUrl,
  webhookEndpointSchema,
} from '@/lib/validations/webhooks'

describe('webhook URL validation', () => {
  it.each([
    'http://localhost./hook',
    'http://api.localhost/hook',
    'http://127.1/hook',
    'http://0x7f000001/hook',
    'http://2130706433/hook',
    'http://[::]/hook',
    'http://[::1]/hook',
    'http://[::ffff:127.0.0.1]/hook',
    'http://[::ffff:10.0.0.1]/hook',
    'http://[fc00::1]/hook',
    'http://[fd12::1]/hook',
    'http://[fe80::1]/hook',
    'http://metadata.google.internal./hook',
  ])('rejects internal canonical URL variant %s', (url) => {
    expect(isSafeWebhookUrl(url)).toBe(false)
    expect(
      webhookEndpointSchema.safeParse({
        url,
        subscribedEvents: ['booking.confirmed'],
      }).success
    ).toBe(false)
  })

  it.each([
    'https://example.com/hooks/openslot',
    'https://hooks.example.com:8443/openslot',
    'http://203.0.113.20/webhook',
    'http://[2001:db8::1]/webhook',
  ])('allows an external HTTP endpoint %s', (url) => {
    expect(isSafeWebhookUrl(url)).toBe(true)
  })
})
