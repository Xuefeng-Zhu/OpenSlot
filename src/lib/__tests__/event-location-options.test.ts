import { describe, expect, it } from 'vitest'
import {
  eventLocationPlaceholder,
  eventLocationSelectOptions,
  eventLocationSelectValue,
  isEventLocationType,
} from '@/lib/event-location-options'

describe('event location options', () => {
  it('keeps manual and generated video options in one ordered list', () => {
    expect(eventLocationSelectOptions.map((option) => option.value)).toEqual([
      'custom',
      'phone',
      'in_person',
      'google_meet',
      'microsoft_teams',
      'online',
    ])
  })

  it('normalizes selected values for manual and generated locations', () => {
    expect(eventLocationSelectValue('phone', null)).toBe('phone')
    expect(eventLocationSelectValue('video_provider', null)).toBe('google_meet')
    expect(eventLocationSelectValue('video_provider', 'microsoft_teams')).toBe(
      'microsoft_teams'
    )
  })

  it('validates location types and returns matching placeholders', () => {
    expect(isEventLocationType('custom')).toBe(true)
    expect(isEventLocationType('google_meet')).toBe(false)
    expect(eventLocationPlaceholder('custom')).toBe(
      'e.g. https://example.com/meeting'
    )
    expect(eventLocationPlaceholder('online')).toBe(
      'e.g. Online meeting details'
    )
  })
})
