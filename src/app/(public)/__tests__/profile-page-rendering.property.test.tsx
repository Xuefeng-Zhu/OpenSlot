import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup } from '@testing-library/react'
import { PublicProfileContent } from '../[username]/profile-content'
import type { ProfileData, EventTypeData } from '../[username]/profile-content'
import { stringOf } from '@/test/fast-check'

/**
 * Feature: ui-backend-integration, Property 1: Profile page renders all required data fields
 * Validates: Requirements 1.4, 1.5
 *
 * For any valid profile and any non-empty array of active event types, rendering
 * the public profile page with this data SHALL produce output containing every
 * public profile field, every visible event field, and every booking link.
 */
describe('Feature: ui-backend-integration, Property 1: Profile page renders all required data fields', () => {
  const nonEmptyAlphanumeric = stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' '
    ),
    { minLength: 1, maxLength: 20 }
  )
    .filter((s) => s.trim().length > 0)

  const slugArb = stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-'
    ),
    { minLength: 1, maxLength: 20 }
  )
    .filter((s) => s.trim().length > 0)

  const locationTypeArb = fc.constantFrom('online', 'phone', 'in_person', 'custom', 'video_provider')
  const videoProviderArb = fc.constantFrom(null, 'google_meet', 'microsoft_teams')

  const timezoneArb = fc.constantFrom(
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo',
    'US/Pacific',
    'Australia/Sydney'
  )

  const profileArb: fc.Arbitrary<ProfileData> = fc.record({
    name: nonEmptyAlphanumeric,
    username: slugArb,
    avatar_url: fc.oneof(
      fc.constant(null),
      fc.webUrl()
    ),
    default_timezone: timezoneArb,
    public_headline: fc.oneof(fc.constant(null), nonEmptyAlphanumeric),
    public_bio: fc.oneof(fc.constant(null), nonEmptyAlphanumeric),
    response_time_label: fc.oneof(fc.constant(null), nonEmptyAlphanumeric),
  })

  const eventTypeArb: fc.Arbitrary<EventTypeData> = fc.record({
    id: fc.uuid(),
    title: nonEmptyAlphanumeric,
    slug: slugArb,
    description: fc.oneof(fc.constant(null), nonEmptyAlphanumeric),
    duration_minutes: fc.integer({ min: 5, max: 480 }),
    location_type: locationTypeArb,
    video_provider: videoProviderArb,
  })

  it('rendered output contains every profile field and every event type field', () => {
    fc.assert(
      fc.property(
        profileArb,
        fc.array(eventTypeArb, { minLength: 1, maxLength: 5 }),
        (profile, eventTypes) => {
          const { container } = render(
            <PublicProfileContent
              profile={profile}
              activeEventTypes={eventTypes}
            />
          )

          const textContent = container.textContent || ''
          const innerHTML = container.innerHTML || ''

          // Profile fields must appear in rendered text output
          expect(textContent).toContain(profile.name)
          expect(textContent).toContain(profile.default_timezone)
          if (profile.public_headline) {
            expect(textContent).toContain(profile.public_headline)
          }
          if (profile.public_bio) {
            expect(textContent).toContain(profile.public_bio)
          }
          if (profile.response_time_label) {
            expect(textContent).toContain(profile.response_time_label)
          }

          // Each event type's fields must appear in rendered output
          for (const eventType of eventTypes) {
            expect(textContent).toContain(eventType.title)
            expect(textContent).toContain(String(eventType.duration_minutes))
            // Slug appears in the booking link href attribute
            expect(innerHTML).toContain(eventType.slug)
            if (eventType.description) {
              expect(textContent).toContain(eventType.description)
            }
          }

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  }, 15000)

  it('omits optional profile metadata sections when values are blank', () => {
    const profile: ProfileData = {
      name: 'Alex Kim',
      username: 'alex-kim',
      avatar_url: null,
      default_timezone: 'America/Los_Angeles',
      public_headline: null,
      public_bio: null,
      response_time_label: null,
    }
    const eventTypes: EventTypeData[] = [
      {
        id: 'event-1',
        title: 'Intro Call',
        slug: 'intro-call',
        description: null,
        duration_minutes: 30,
        location_type: 'online',
        video_provider: null,
      },
    ]

    const { container } = render(
      <PublicProfileContent profile={profile} activeEventTypes={eventTypes} />
    )

    const textContent = container.textContent || ''

    expect(textContent).toContain('Alex Kim')
    expect(textContent).toContain('America/Los_Angeles')
    expect(textContent).not.toContain('Typically responds')

    cleanup()
  })
})
