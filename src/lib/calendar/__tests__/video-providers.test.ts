import { describe, expect, it } from 'vitest'
import {
  calendarProviderForVideoProvider,
  defaultVideoProvider,
  getVideoProviderReadiness,
  parseVideoProvider,
  videoProviderLabel,
  videoProviderOptions,
} from '../video-providers'

const activeGoogleConnection = {
  provider: 'google',
  accountEmail: 'host@example.com',
  status: 'active',
  calendars: [{ useForWrites: true }],
}

describe('video provider metadata', () => {
  it('centralizes provider labels and backing calendar providers', () => {
    expect(videoProviderOptions).toEqual([
      {
        id: 'google_meet',
        label: 'Google Meet',
        calendarProvider: 'google',
      },
      {
        id: 'microsoft_teams',
        label: 'Microsoft Teams',
        calendarProvider: 'microsoft',
      },
    ])
    expect(videoProviderLabel('google_meet')).toBe('Google Meet')
    expect(videoProviderLabel('microsoft_teams')).toBe('Microsoft Teams')
    expect(calendarProviderForVideoProvider('google_meet')).toBe('google')
    expect(calendarProviderForVideoProvider('microsoft_teams')).toBe(
      'microsoft'
    )
    expect(defaultVideoProvider).toBe('google_meet')
  })

  it('parses only supported generated video provider ids', () => {
    expect(parseVideoProvider('google_meet')).toBe('google_meet')
    expect(parseVideoProvider('zoom')).toBeNull()
    expect(videoProviderLabel('zoom')).toBeNull()
  })
})

describe('video provider readiness', () => {
  it('reports ready when the backing calendar connection can write events', () => {
    expect(
      getVideoProviderReadiness('google_meet', [activeGoogleConnection])
    ).toMatchObject({
      ready: true,
      status: 'ready',
      label: 'Google Meet',
      calendarProvider: 'google',
      message: 'Google Meet is ready to generate links for new bookings.',
      badgeLabel: 'Ready',
      description: 'Google Meet links can be generated for new bookings.',
    })
  })

  it('reports missing, unhealthy, and non-writable provider states', () => {
    expect(getVideoProviderReadiness('microsoft_teams', [])).toMatchObject({
      ready: false,
      status: 'missing_connection',
      message:
        'Microsoft Teams needs a connected calendar account before links can be generated.',
      badgeLabel: 'Setup needed',
    })

    expect(
      getVideoProviderReadiness('google_meet', [
        {
          ...activeGoogleConnection,
          status: 'error',
        },
      ])
    ).toMatchObject({
      ready: false,
      status: 'connection_attention',
      message:
        'Google Meet calendar connection needs attention before links can be generated.',
      badgeLabel: 'Needs attention',
      description:
        'Reconnect host@example.com before OpenSlot can generate Google Meet links.',
    })

    expect(
      getVideoProviderReadiness('google_meet', [
        {
          ...activeGoogleConnection,
          calendars: [{ useForWrites: false }],
        },
      ])
    ).toMatchObject({
      ready: false,
      status: 'write_calendar_missing',
      message: 'Google Meet needs a writable calendar selected for booking writes.',
      badgeLabel: 'Write calendar off',
      description:
        'Enable a writable calendar on host@example.com before OpenSlot can generate Google Meet links.',
    })
  })
})
