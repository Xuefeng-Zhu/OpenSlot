import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotPicker } from '../slot-picker'

type SlotPickerProps = ComponentProps<typeof SlotPicker>

const eventType: SlotPickerProps['eventType'] = {
  id: 'event-type-1',
  title: 'Discovery Call',
  slug: 'discovery-call',
  description: 'A short intro call.',
  duration_minutes: 30,
  location_type: 'video',
  location_value: null,
  video_provider: null,
  invitee_questions: [],
  user_id: 'host-1',
}

const hostProfile: SlotPickerProps['hostProfile'] = {
  id: 'host-1',
  name: 'Sarah Chen',
  username: 'sarah',
  avatar_url: null,
}

describe('SlotPicker', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders with a valid timezone before browser detection succeeds', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: '' }),
        }) as Intl.DateTimeFormat
    )

    expect(() =>
      render(<SlotPicker eventType={eventType} hostProfile={hostProfile} />)
    ).not.toThrow()

    expect(screen.getByLabelText('Timezone')).toBeDefined()
    expect(screen.getByText('UTC')).toBeDefined()
  })
})
