import { describe, expect, it, vi } from 'vitest'
import { restoreDemoState } from '../../../e2e/support/db/snapshots'
import type {
  DemoStateSnapshot,
  E2EAdminClient,
} from '../../../e2e/support/db/types'

describe('restoreDemoState', () => {
  it('restores settings by profile_id instead of relying on row id filters', async () => {
    const profileUpdateEq = vi.fn(async () => ({ error: null }))
    const profileUpdate = vi.fn(() => ({ eq: profileUpdateEq }))
    const settingsUpsert = vi.fn(() => ({ error: null }))
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return { update: profileUpdate }
        }

        if (table === 'user_settings') {
          return { upsert: settingsUpsert }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    } as unknown as E2EAdminClient
    const snapshot = {
      profile: {
        id: 'profile-1',
        email: 'demo@example.com',
        name: 'Demo User',
        username: 'demo',
        default_timezone: 'America/New_York',
        avatar_url: null,
        updated_at: '2026-05-25T00:00:00.000Z',
      },
      settings: {
        id: 'settings-1',
        profile_id: 'profile-1',
        notifications_seen_at: null,
      },
    } as unknown as DemoStateSnapshot

    await restoreDemoState(adminClient, snapshot)

    expect(settingsUpsert).toHaveBeenCalledWith(snapshot.settings, {
      onConflict: 'profile_id',
    })
  })
})
