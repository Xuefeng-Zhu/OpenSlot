import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup } from '@testing-library/react'
import { PublicProfileContent } from '../[username]/profile-content'
import type { ProfileData, EventTypeData } from '../[username]/profile-content'

/**
 * Feature: ui-backend-integration, Property 1: Profile page renders all required data fields
 * Validates: Requirements 1.4, 1.5
 *
 * For any valid profile (with name, avatar_url, default_timezone) and any non-empty
 * array of active event types (each with title, description, duration_minutes,
 * location_type, slug), rendering the public profile page with this data SHALL produce
 * output containing every profile field and every event type field.
 */
describe('Feature: ui-backend-integration, Property 1: Profile page renders all required data fields', () => {
  const nonEmptyAlphanumeric = fc
    .stringOf(
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

  const slugArb = fc
    .stringOf(
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

          // Each event type's fields must appear in rendered output
          for (const eventType of eventTypes) {
            expect(textContent).toContain(eventType.title)
            expect(textContent).toContain(String(eventType.duration_minutes))
            expect(textContent).toContain(eventLocationLabel(eventType))
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
  })
})

function eventLocationLabel(eventType: EventTypeData): string {
  if (eventType.video_provider === 'google_meet') return 'Google Meet'
  if (eventType.video_provider === 'microsoft_teams') return 'Microsoft Teams'

  if (eventType.location_type === 'in_person') return 'In person'
  if (eventType.location_type === 'video_provider') return 'Video'
  return eventType.location_type === 'online'
    ? 'Online'
    : eventType.location_type === 'phone'
      ? 'Phone'
      : 'Custom'
}
