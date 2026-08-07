import { describe, expect, it } from 'vitest'
import {
  isSafeWebhookAddress,
  isSafeWebhookUrl,
  webhookEndpointSchema,
} from '@/lib/validations/webhooks'

describe('webhook URL validation', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
  ])('rejects resolved non-public address %s', (address) => {
    expect(isSafeWebhookAddress(address)).toBe(false)
  })

  it.each(['203.0.113.20', '2001:db8::1'])(
    'allows resolved public address %s',
    (address) => {
      expect(isSafeWebhookAddress(address)).toBe(true)
    }
  )

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
