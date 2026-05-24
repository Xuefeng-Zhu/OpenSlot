import { describe, expect, it } from 'vitest'
import {
  webhookEventLabel,
  webhookEventOptions,
  webhookEventTypes,
} from '../event-types'

describe('webhook event types', () => {
  it('keeps UI options aligned with accepted subscription values', () => {
    expect(webhookEventOptions.map((option) => option.value).sort()).toEqual(
      [...webhookEventTypes].sort()
    )
  })

  it('returns display labels for known events and falls back for unknown values', () => {
    expect(webhookEventLabel('booking.confirmed')).toBe('Confirmed')
    expect(webhookEventLabel('custom.event')).toBe('custom.event')
  })
})
