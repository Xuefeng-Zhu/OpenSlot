import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, cleanup } from '@testing-library/react'
import { BookingSummaryCard } from '../booking-summary-card'

/**
 * Property 5: BookingSummaryCard Completeness
 * Validates: Requirements 2.13
 *
 * For any valid BookingSummaryCard props (non-empty hostName, eventTitle, date,
 * time, positive duration, non-empty timezone), the rendered output SHALL contain
 * all six provided values as visible text content.
 */
describe('Property 5: BookingSummaryCard Completeness', () => {
  it('all provided props appear in rendered text content', () => {
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

    fc.assert(
      fc.property(
        nonEmptyAlphanumeric,
        nonEmptyAlphanumeric,
        nonEmptyAlphanumeric,
        nonEmptyAlphanumeric,
        positiveDuration,
        nonEmptyAlphanumeric,
        (hostName, eventTitle, date, time, duration, timezone) => {
          const { container } = render(
            <BookingSummaryCard
              hostName={hostName}
              eventTitle={eventTitle}
              date={date}
              time={time}
              duration={duration}
              timezone={timezone}
            />
          )

          const textContent = container.textContent || ''

          expect(textContent).toContain(hostName)
          expect(textContent).toContain(eventTitle)
          expect(textContent).toContain(date)
          expect(textContent).toContain(time)
          expect(textContent).toContain(timezone)
          expect(textContent).toContain(String(duration))

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('renders extended event type preview details when provided', () => {
    const { container } = render(
      <BookingSummaryCard
        hostName="Frank Zhu"
        eventTitle="Question Demo"
        description="Preview all configured event details."
        urlSlug="question-demo"
        visibility="Visible to guests"
        duration={30}
        bufferBefore={5}
        bufferAfter={10}
        minNotice={60}
        maxDaysAhead={45}
        timezone="America/Los_Angeles"
        showTimezone={false}
        locationType="Custom link"
        locationDetails="https://meet.example.com/demo"
        questions={[
          {
            id: 'priority',
            label: 'Priority',
            type: 'select',
            required: true,
            options: ['Low', 'Medium', 'High'],
          },
          {
            id: 'recording',
            label: 'I agree to a recording',
            type: 'checkbox',
            required: false,
          },
        ]}
      />
    )

    const textContent = container.textContent || ''

    expect(textContent).toContain('Preview all configured event details.')
    expect(textContent).toContain('question-demo')
    expect(textContent).toContain('Visible to guests')
    expect(textContent).not.toContain('Fri, May 15, 2026')
    expect(textContent).not.toContain('10:00 AM')
    expect(textContent).toContain('5 min')
    expect(textContent).toContain('10 min')
    expect(textContent).toContain('60 min')
    expect(textContent).toContain('45 days')
    expect(textContent).not.toContain('America/Los_Angeles')
    expect(textContent).toContain('Custom link')
    expect(textContent).toContain('https://meet.example.com/demo')
    expect(textContent).toContain('2 configured')
    expect(textContent).toContain('Priority')
    expect(textContent).toContain('Options: Low, Medium, High')
    expect(textContent).toContain('I agree to a recording')
    expect(textContent).toContain('Checkbox')

    cleanup()
  })
})
