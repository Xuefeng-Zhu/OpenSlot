import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
      {...overrides}
    />
  )
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AvailabilityClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('creates a schedule from the schedule dropdown', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          schedule: {
            id: 'schedule-project',
            name: 'Project hours',
            timezone: 'America/New_York',
            is_default: false,
            assignedEventTypeCount: 0,
            assignedEventTypes: [],
          },
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    renderAvailability()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Active schedule' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Create schedule' })
    )
    fireEvent.change(await screen.findByLabelText('New schedule'), {
      target: { value: 'Project hours' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create schedule' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/availability/schedules',
        expect.objectContaining({ method: 'POST' })
      )
    )

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(requestInit.body))).toEqual({
      name: 'Project hours',
      timezone: 'America/New_York',
    })
    expect(routerMocks.push).toHaveBeenCalledWith(
      '/availability?scheduleId=schedule-project'
    )
    expect(routerMocks.refresh).toHaveBeenCalled()
  })

  it('renames the selected schedule from the action menu', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          schedule: {
            id: 'schedule-default',
            name: 'Client hours',
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
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    renderAvailability()

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Schedule actions' }),
      {
        button: 0,
        ctrlKey: false,
      }
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    fireEvent.change(await screen.findByLabelText('Schedule name'), {
      target: { value: 'Client hours' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/availability/schedules/schedule-default',
        expect.objectContaining({ method: 'PATCH' })
      )
    )

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(requestInit.body))).toEqual({
      name: 'Client hours',
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Active schedule' }).textContent
      ).toContain('Client hours (default)')
    )
    expect(routerMocks.refresh).toHaveBeenCalled()
  })

  it('disables custom date-specific hours until the time range is valid', () => {
    renderAvailability()

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2099-05-10' },
    })
    fireEvent.click(screen.getByLabelText('Custom hours'))

    const addOverride = screen.getByRole('button', { name: 'Add override' })

    expect(addOverride).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toBe(
      'Custom hours need a start and end time.'
    )

    fireEvent.change(screen.getByLabelText('Start'), {
      target: { value: '14:00' },
    })
    fireEvent.change(screen.getByLabelText('End'), {
      target: { value: '13:00' },
    })

    expect(addOverride).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toBe(
      'End time must be after start time.'
    )

    fireEvent.change(screen.getByLabelText('End'), {
      target: { value: '15:00' },
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(addOverride).toHaveProperty('disabled', false)
  })

  it('preserves weekly interval ids when deleting the first interval', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))

        return new Response(
          JSON.stringify({
            success: true,
            rules: body.rules,
            overrides: body.overrides,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    )
    vi.stubGlobal('fetch', fetchMock)

    renderAvailability({
      initialRules: [
        {
          id: 'rule-first',
          weekday: 1,
          start_time: '09:00',
          end_time: '10:00',
          is_active: true,
        },
        {
          id: 'rule-second',
          weekday: 1,
          start_time: '11:00',
          end_time: '12:00',
          is_active: true,
        },
      ],
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove interval 1 for Monday' })
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save availability' })
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/availability',
        expect.any(Object)
      )
    )

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(requestInit.body))

    expect(body.rules).toEqual([
      {
        id: 'rule-second',
        weekday: 1,
        start_time: '11:00',
        end_time: '12:00',
        is_active: true,
      },
    ])
    expect(body.deletedRuleIds).toEqual(['rule-first'])
  })
})
