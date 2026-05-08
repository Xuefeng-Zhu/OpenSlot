import { describe, expect, it, vi } from 'vitest'
import { listCalendarConnectionSummaries } from '../connections'

describe('listCalendarConnectionSummaries', () => {
  it('returns safe connection summaries grouped with calendars', async () => {
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'provider_connections') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: 'connection-1',
                      provider: 'google',
                      account_email: 'sarah@example.com',
                      status: 'active',
                      connected_at: '2026-05-08T00:00:00.000Z',
                      last_synced_at: null,
                      last_error: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'provider_calendars') {
          return {
            select: () => ({
              in: (_column: string, values: string[]) => ({
                order: async () => ({
                  data: [
                    {
                      id: 'calendar-1',
                      connection_id: values[0],
                      external_calendar_id: 'primary',
                      summary: 'Primary',
                      timezone: 'America/Los_Angeles',
                      is_primary: true,
                      use_for_availability: true,
                      use_for_writes: true,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as any

    const summaries = await listCalendarConnectionSummaries(
      adminClient,
      'profile-1'
    )

    expect(summaries).toEqual([
      {
        id: 'connection-1',
        provider: 'google',
        accountEmail: 'sarah@example.com',
        status: 'active',
        connectedAt: '2026-05-08T00:00:00.000Z',
        lastSyncedAt: null,
        lastError: null,
        calendars: [
          {
            id: 'calendar-1',
            externalCalendarId: 'primary',
            summary: 'Primary',
            timezone: 'America/Los_Angeles',
            isPrimary: true,
            useForAvailability: true,
            useForWrites: true,
          },
        ],
      },
    ])
  })

  it('does not query calendars when there are no connections', async () => {
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table !== 'provider_connections') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        }
      }),
    } as any

    const summaries = await listCalendarConnectionSummaries(
      adminClient,
      'profile-1'
    )

    expect(summaries).toEqual([])
    expect(adminClient.from).toHaveBeenCalledTimes(1)
  })
})
