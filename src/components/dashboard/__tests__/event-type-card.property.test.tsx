import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup } from '@testing-library/react'
import { EventTypeCard } from '../event-type-card'

/**
 * Property 6: EventTypeCard Completeness
 * Validates: Requirements 2.14
 *
 * For any valid EventTypeCard props (non-empty title, positive durationMinutes,
 * non-empty locationType, boolean isActive), the rendered output SHALL contain
 * the title, a duration indicator, the location type, and a status indicator
 * reflecting the isActive state.
 */
describe('Property 6: EventTypeCard Completeness', () => {
  it('title, duration, location, and status indicator are present in output', () => {
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

    const positiveDuration = fc.integer({ min: 1, max: 480 })
    const isActiveArb = fc.boolean()

    fc.assert(
      fc.property(
        nonEmptyAlphanumeric,
        positiveDuration,
        nonEmptyAlphanumeric,
        isActiveArb,
        (title, durationMinutes, locationType, isActive) => {
          const { container } = render(
            <EventTypeCard
              id="test-id"
              title={title}
              durationMinutes={durationMinutes}
              locationType={locationType}
              slug="test-slug"
              isActive={isActive}
              bookingUrl="https://example.com/book"
              onCopyLink={vi.fn()}
              onPreview={vi.fn()}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
            />
          )

          const textContent = container.textContent || ''

          // Title must appear in rendered output
          expect(textContent).toContain(title)

          // Duration number must appear in rendered output
          expect(textContent).toContain(String(durationMinutes))

          // Location type must appear in rendered output
          expect(textContent).toContain(locationType)

          // Status indicator must reflect isActive state
          if (isActive) {
            expect(textContent).toContain('Active')
          } else {
            expect(textContent).toContain('Paused')
          }

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })
})
