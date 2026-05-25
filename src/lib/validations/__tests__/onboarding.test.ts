import { describe, expect, it } from 'vitest'
import {
  buildOnboardingAvailabilityRules,
  buildOnboardingEventSlug,
  onboardingSchema,
} from '@/lib/validations/onboarding'

const validOnboardingInput = {
  profile: {
    displayName: 'Sarah Chen',
    username: 'sarah-chen',
  },
  availability: {
    monday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
    tuesday: { enabled: false, intervals: [] },
    wednesday: { enabled: false, intervals: [] },
    thursday: { enabled: false, intervals: [] },
    friday: { enabled: false, intervals: [] },
    saturday: { enabled: false, intervals: [] },
    sunday: { enabled: true, intervals: [{ start: '10:00', end: '12:00' }] },
  },
  eventType: {
    title: 'Intro Call',
    duration: '30',
    locationType: 'custom',
    locationValue: 'Zoom',
    videoProvider: null,
  },
  timezone: 'America/Los_Angeles',
}

describe('onboardingSchema', () => {
  it('validates setup data and maps weekdays for persistence', () => {
    const result = onboardingSchema.safeParse(validOnboardingInput)

    expect(result.success).toBe(true)
    if (!result.success) return

    const rules = buildOnboardingAvailabilityRules(result.data.availability)

    expect(rules).toEqual([
      {
        weekday: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_active: true,
      },
      {
        weekday: 0,
        start_time: '10:00',
        end_time: '12:00',
        is_active: true,
      },
    ])
    expect(result.data.eventType.duration).toBe(30)
    expect(result.data.eventType.locationType).toBe('custom')
    expect(result.data.eventType.locationValue).toBe('Zoom')
    expect(buildOnboardingEventSlug(result.data.eventType.title)).toBe(
      'intro-call'
    )
  })

  it('allows generated video locations with a provider', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboardingInput,
      eventType: {
        ...validOnboardingInput.eventType,
        locationType: 'video_provider',
        locationValue: '',
        videoProvider: 'google_meet',
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.eventType.videoProvider).toBe('google_meet')
  })

  it('rejects manual locations without details', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboardingInput,
      eventType: {
        ...validOnboardingInput.eventType,
        locationType: 'online',
        locationValue: '',
        videoProvider: null,
      },
    })

    expect(result.success).toBe(false)
  })

  it('rejects onboarding with no bookable availability', () => {
    const input = {
      ...validOnboardingInput,
      availability: Object.fromEntries(
        Object.keys(validOnboardingInput.availability).map((day) => [
          day,
          { enabled: false, intervals: [] },
        ])
      ),
    }

    const result = onboardingSchema.safeParse(input)

    expect(result.success).toBe(false)
  })
})
