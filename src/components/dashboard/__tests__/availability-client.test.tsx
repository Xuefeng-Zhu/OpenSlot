import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AvailabilityClient } from '../availability-client'
import type { AvailabilitySchedule } from '../availability-model'

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

function schedules(): AvailabilitySchedule[] {
  return [
    {
      id: 'schedule-default',
      name: 'Default schedule',
      timezone: 'America/New_York',
      is_default: true,
      assignedEventTypeCount: 1,
      assignedEventTypes: [
        {
          id: 'event-1',
          title: 'Intro call',
          slug: 'intro-call',
        },
      ],
    },
    {
      id: 'schedule-sales',
      name: 'Sales hours',
      timezone: 'America/New_York',
      is_default: false,
      assignedEventTypeCount: 0,
      assignedEventTypes: [],
    },
  ]
}

function renderAvailability(
  overrides: Partial<ComponentProps<typeof AvailabilityClient>> = {}
) {
  render(
    <AvailabilityClient
      schedules={schedules()}
      selectedScheduleId="schedule-default"
      initialRules={[
        {
          id: 'rule-1',
          weekday: 1,
          start_time: '09:00',
          end_time: '17:00',
          is_active: true,
        },
      ]}
      initialOverrides={[]}
      timezone="America/New_York"
      userId="profile-1"
      {...overrides}
    />
  )
}

describe('AvailabilityClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the selected default schedule as working hours', () => {
    renderAvailability()

    expect(
      screen.getByRole('button', { name: 'Active schedule' }).textContent
    ).toContain('Working hours (default)')
  })

  it('lists schedules and exposes the create action from the header dropdown', async () => {
    renderAvailability()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Active schedule' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(
      await screen.findByRole('menuitem', {
        name: /Working hours \(default\)/,
      })
    ).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Sales hours' })).toBeDefined()
    expect(
      screen.getByRole('menuitem', { name: 'Create schedule' })
    ).toBeDefined()
  })

  it('shows event type links in the active-on dropdown', async () => {
    renderAvailability()

    fireEvent.pointerDown(screen.getByRole('button', { name: /Active on:/ }), {
      button: 0,
      ctrlKey: false,
    })

    const eventTypeLink = await screen.findByRole('menuitem', {
      name: /Intro call/,
    })

    expect(eventTypeLink.getAttribute('href')).toBe('/event-types/event-1/edit')
  })

  it('opens action menu dialogs with blocked delete state for default schedules', async () => {
    renderAvailability()

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Schedule actions' }),
      {
        button: 0,
        ctrlKey: false,
      }
    )

    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDefined()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(
      await screen.findByText('Default schedules cannot be deleted.')
    ).toBeDefined()
    expect(
      (screen.getByRole('button', {
        name: 'Delete schedule',
      }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
})
