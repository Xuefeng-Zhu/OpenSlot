import { describe, expect, it } from 'vitest'
import {
  dashboardAvailabilityCopy,
  deriveDashboardAvailabilityState,
  type DashboardAvailabilityStateInput,
} from '../availability-state'

const now = new Date('2026-05-01T00:30:00.000Z')

function input(
  overrides: Partial<DashboardAvailabilityStateInput> = {}
): DashboardAvailabilityStateInput {
  return {
    activeEventTypes: [{ schedule_id: 'schedule-1' }],
    schedules: [
      { id: 'schedule-1', timezone: 'America/Los_Angeles' },
      { id: 'schedule-2', timezone: 'America/Los_Angeles' },
    ],
    rules: [],
    overrides: [],
    now,
    ...overrides,
  }
}

describe('dashboard availability state', () => {
  it('reports no active event types before considering schedule hours', () => {
    expect(
      deriveDashboardAvailabilityState(
        input({
          activeEventTypes: [],
          rules: [{ schedule_id: 'schedule-1', is_active: true }],
        })
      )
    ).toBe('no_active_event_types')
  })

  it('reports configured for an active recurring rule on an active type schedule', () => {
    expect(
      deriveDashboardAvailabilityState(
        input({ rules: [{ schedule_id: 'schedule-1', is_active: true }] })
      )
    ).toBe('configured')
  })

  it('ignores inactive rules and rules on unrelated schedules', () => {
    expect(
      deriveDashboardAvailabilityState(
        input({
          rules: [
            { schedule_id: 'schedule-1', is_active: false },
            { schedule_id: 'schedule-2', is_active: true },
          ],
        })
      )
    ).toBe('needs_hours')
  })

  it('uses the schedule timezone to include current and future positive overrides', () => {
    expect(
      deriveDashboardAvailabilityState(
        input({
          overrides: [
            {
              schedule_id: 'schedule-1',
              date: '2026-04-30',
              start_time: '09:00:00',
              end_time: '10:00:00',
              is_available: true,
            },
          ],
        })
      )
    ).toBe('configured')

    expect(
      deriveDashboardAvailabilityState(
        input({
          schedules: [{ id: 'schedule-1', timezone: 'Asia/Tokyo' }],
          overrides: [
            {
              schedule_id: 'schedule-1',
              date: '2026-04-30',
              start_time: '09:00',
              end_time: '10:00',
              is_available: true,
            },
          ],
        })
      )
    ).toBe('needs_hours')

    expect(
      deriveDashboardAvailabilityState(
        input({
          overrides: [
            {
              schedule_id: 'schedule-1',
              date: '2026-05-10',
              start_time: '09:00',
              end_time: '10:00',
              is_available: true,
            },
          ],
        })
      )
    ).toBe('configured')
  })

  it('rejects non-positive, unrelated, past, and malformed overrides', () => {
    expect(
      deriveDashboardAvailabilityState(
        input({
          overrides: [
            {
              schedule_id: 'schedule-2',
              date: '2026-05-10',
              start_time: '09:00',
              end_time: '10:00',
              is_available: true,
            },
            {
              schedule_id: 'schedule-1',
              date: '2026-05-10',
              start_time: null,
              end_time: null,
              is_available: true,
            },
            {
              schedule_id: 'schedule-1',
              date: '2026-05-10',
              start_time: '10:00',
              end_time: '09:00',
              is_available: true,
            },
            {
              schedule_id: 'schedule-1',
              date: '2026-04-29',
              start_time: '09:00',
              end_time: '10:00',
              is_available: true,
            },
            {
              schedule_id: 'schedule-1',
              date: 'not-a-date',
              start_time: '09:00',
              end_time: '10:00',
              is_available: true,
            },
          ],
        })
      )
    ).toBe('needs_hours')
  })

  it('does not claim configured when a schedule timezone is invalid', () => {
    expect(
      deriveDashboardAvailabilityState(
        input({
          schedules: [{ id: 'schedule-1', timezone: 'Invalid/Timezone' }],
          overrides: [
            {
              schedule_id: 'schedule-1',
              date: '2026-05-10',
              start_time: '09:00',
              end_time: '10:00',
              is_available: true,
            },
          ],
        })
      )
    ).toBe('needs_hours')
  })

  it('keeps the reviewed availability copy exact', () => {
    expect(dashboardAvailabilityCopy).toEqual({
      configured: {
        value: 'Configured',
        description: 'Booking hours are set for at least one active event type.',
        actionHref: '/availability',
      },
      needs_hours: {
        value: 'Needs hours',
        description: 'Add hours to a schedule used by an active event type.',
        actionHref: '/availability',
      },
      no_active_event_types: {
        value: 'No active types',
        description: 'Create or activate an event type before sharing availability.',
        actionHref: '/event-types',
      },
    })
  })
})
