import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupStaleDemoEventTypes } from '../../../e2e/global-setup'
import { ensureDemoAuthUser } from '../../../e2e/support/demo-auth'
import { demoHost, resetRuntimeDemoHostForTests } from '../../../e2e/demo-data'
import {
  readDemoHostAuthState,
  saveDemoHostSessionState,
} from '../../../e2e/support/auth-state'
import type { E2EAdminClient } from '../../../e2e/support/db/types'
import type { BackendPorts } from '@/lib/backend/ports'

describe('E2E demo auth setup', () => {
  let runtimeDir: string

  beforeEach(() => {
    runtimeDir = mkdtempSync(path.join(tmpdir(), 'openslot-e2e-'))
    vi.stubEnv(
      'E2E_DEMO_HOST_FILE',
      path.join(runtimeDir, 'e2e-demo-host.json')
    )
    vi.stubEnv(
      'E2E_DEMO_AUTH_STATE_FILE',
      path.join(runtimeDir, 'e2e-demo-auth-state.json')
    )
    resetRuntimeDemoHostForTests()
  })

  afterEach(() => {
    resetRuntimeDemoHostForTests()
    vi.unstubAllEnvs()
    rmSync(runtimeDir, { recursive: true, force: true })
  })

  it('reuses a saved backend auth state before password sign-in', async () => {
    saveDemoHostSessionState({
      accessToken: 'cached-access-token',
      refreshToken: 'cached-refresh-token',
      user: { id: 'auth-user-cached', email: demoHost.email },
    })

    const backend = {
      auth: {
        getCurrentUser: vi.fn(async () => ({
          data: { id: 'auth-user-cached', email: demoHost.email },
          error: null,
        })),
        refreshSession: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
      },
    } as unknown as BackendPorts
    const adminClient = {
      auth: {
        updateUser: vi.fn(),
      },
      from: vi.fn(),
    } as unknown as E2EAdminClient

    await expect(ensureDemoAuthUser(backend, adminClient)).resolves.toBe(
      'auth-user-cached'
    )
    expect(backend.auth.getCurrentUser).toHaveBeenCalledWith(
      'cached-access-token'
    )
    expect(backend.auth.refreshSession).not.toHaveBeenCalled()
    expect(backend.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(adminClient.from).not.toHaveBeenCalled()
  })

  it('refreshes a saved backend auth state when the access token is stale', async () => {
    saveDemoHostSessionState({
      accessToken: 'stale-access-token',
      refreshToken: 'cached-refresh-token',
      user: { id: 'auth-user-cached', email: demoHost.email },
    })

    const backend = {
      auth: {
        getCurrentUser: vi.fn(async () => ({
          data: null,
          error: { message: 'Access token expired' },
        })),
        refreshSession: vi.fn(async () => ({
          data: {
            accessToken: 'refreshed-access-token',
            refreshToken: 'refreshed-refresh-token',
            user: { id: 'auth-user-cached', email: demoHost.email },
          },
          error: null,
        })),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
      },
    } as unknown as BackendPorts
    const adminClient = {
      auth: {
        updateUser: vi.fn(),
      },
      from: vi.fn(),
    } as unknown as E2EAdminClient

    await expect(ensureDemoAuthUser(backend, adminClient)).resolves.toBe(
      'auth-user-cached'
    )
    expect(backend.auth.refreshSession).toHaveBeenCalledWith(
      'cached-refresh-token'
    )
    expect(backend.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(readDemoHostAuthState()?.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'openslot_backend_access_token',
          value: 'refreshed-access-token',
        }),
      ])
    )
  })

  it('refreshes seeded credentials when the demo auth user already exists but sign-in fails', async () => {
    const backend = {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi
          .fn()
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Butterbase request failed with 401' },
          })
          .mockResolvedValueOnce({
            data: {
              accessToken: 'access-token',
              user: { id: 'auth-user-1', email: demoHost.email },
            },
            error: null,
          }),
      },
    } as unknown as BackendPorts
    const profileQuery = createMaybeSingleQuery({
      auth_user_id: 'auth-user-1',
    })
    const adminClient = {
      auth: {
        updateUser: vi.fn(async () => ({
          data: { user: null },
          error: null,
        })),
      },
      from: vi.fn(() => profileQuery),
    } as unknown as E2EAdminClient

    await expect(ensureDemoAuthUser(backend, adminClient)).resolves.toBe(
      'auth-user-1'
    )
    expect(adminClient.auth.updateUser).toHaveBeenCalledWith({
      userId: 'auth-user-1',
      email: demoHost.email,
      password: demoHost.password,
    })
  })

  it('recreates the seeded auth user when Butterbase cannot update auth credentials', async () => {
    const backend = {
      auth: {
        signUp: vi.fn(async () => ({
          data: { id: 'auth-user-2', email: demoHost.email },
          error: null,
        })),
        signInWithPassword: vi
          .fn()
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Butterbase request failed with 401' },
          })
          .mockResolvedValueOnce({
            data: {
              accessToken: 'access-token',
              user: { id: 'auth-user-2', email: demoHost.email },
            },
            error: null,
          }),
      },
    } as unknown as BackendPorts
    const profileQuery = createMaybeSingleQuery({
      auth_user_id: 'auth-user-1',
    })
    const deleteUser = vi.fn(async () => ({
      data: { success: true },
      error: null,
    }))
    const adminClient = {
      auth: {
        updateUser: vi.fn(async () => ({
          data: null,
          error: {
            message: 'Auth user updates are not supported by this function yet',
          },
        })),
        admin: { deleteUser },
      },
      from: vi.fn(() => profileQuery),
    } as unknown as E2EAdminClient

    await expect(ensureDemoAuthUser(backend, adminClient)).resolves.toBe(
      'auth-user-2'
    )
    expect(deleteUser).toHaveBeenCalledWith('auth-user-1')
    expect(backend.auth.signUp).toHaveBeenCalledTimes(1)
  })

  it('stores disposable runtime credentials when the fixed seeded auth user cannot be repaired', async () => {
    const signUp = vi.fn(
      async (_input: {
        email: string
        password: string
        displayName?: string
      }) => ({
        data: { id: 'auth-user-2', email: 'demo+e2e-1@openslot.dev' },
        error: null,
      })
    )
    const backend = {
      auth: {
        signUp,
        signInWithPassword: vi
          .fn()
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Butterbase request failed with 401' },
          })
          .mockResolvedValueOnce({
            data: {
              accessToken: 'access-token',
              user: { id: 'auth-user-2', email: 'demo+e2e-1@openslot.dev' },
            },
            error: null,
          }),
      },
    } as unknown as BackendPorts
    const profileQuery = createMaybeSingleQuery({
      auth_user_id: 'auth-user-1',
    })
    const adminClient = {
      auth: {
        updateUser: vi.fn(async () => ({
          data: null,
          error: {
            message: 'Auth user updates are not supported by this function yet',
          },
        })),
        admin: {
          deleteUser: vi.fn(async () => ({
            data: null,
            error: {
              message: 'Auth user deletion is not supported by this function yet',
            },
          })),
        },
      },
      from: vi.fn(() => profileQuery),
    } as unknown as E2EAdminClient

    await expect(ensureDemoAuthUser(backend, adminClient)).resolves.toBe(
      'auth-user-2'
    )

    const replacementInput = signUp.mock.calls[0][0]
    expect(replacementInput.email).toMatch(
      /^demo\.e2e\.\d+\.[a-f0-9-]+@openslot\.dev$/
    )
    expect(demoHost.email).toBe(replacementInput.email)
    expect(demoHost.authUserId).toBe('auth-user-2')

    const runtimeFile = process.env.E2E_DEMO_HOST_FILE
    expect(runtimeFile && existsSync(runtimeFile)).toBe(true)
    expect(JSON.parse(readFileSync(runtimeFile!, 'utf8'))).toMatchObject({
      authUserId: 'auth-user-2',
      email: replacementInput.email,
      password: demoHost.password,
    })
  })

  it('does not attempt auth repair when the auth service is rate limited', async () => {
    const backend = {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(async () => ({
          data: null,
          error: { message: 'Rate limit exceeded, retry in 9 minutes' },
        })),
      },
    } as unknown as BackendPorts
    const adminClient = {
      auth: {
        updateUser: vi.fn(),
        admin: {
          deleteUser: vi.fn(),
        },
      },
      from: vi.fn(),
    } as unknown as E2EAdminClient

    await expect(ensureDemoAuthUser(backend, adminClient)).rejects.toThrow(
      'Butterbase auth is rate-limited'
    )
    expect(adminClient.auth.updateUser).not.toHaveBeenCalled()
    expect(adminClient.auth.admin?.deleteUser).not.toHaveBeenCalled()
    expect(backend.auth.signUp).not.toHaveBeenCalled()
    expect(adminClient.from).not.toHaveBeenCalled()
  })

  it('fails clearly when replacement signup does not return an auth user id', async () => {
    const backend = {
      auth: {
        signUp: vi.fn(async () => ({
          data: {},
          error: null,
        })),
        signInWithPassword: vi.fn(async () => ({
          data: null,
          error: { message: 'Butterbase request failed with 401' },
        })),
      },
    } as unknown as BackendPorts
    const profileQuery = createMaybeSingleQuery({
      auth_user_id: 'auth-user-1',
    })
    const adminClient = {
      auth: {
        updateUser: vi.fn(async () => ({
          data: null,
          error: {
            message: 'Auth user updates are not supported by this function yet',
          },
        })),
        admin: {
          deleteUser: vi.fn(async () => ({
            data: null,
            error: {
              message: 'Auth user deletion is not supported by this function yet',
            },
          })),
        },
      },
      from: vi.fn(() => profileQuery),
    } as unknown as E2EAdminClient

    await expect(ensureDemoAuthUser(backend, adminClient)).rejects.toThrow(
      'replacement signup failed: signup did not return an auth user id'
    )
  })
})

describe('E2E demo event type cleanup', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('only inspects age-gated E2E event type candidates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T12:00:00.000Z'))

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      lt: vi.fn(async () => ({ data: [], error: null })),
    }
    const adminClient = {
      from: vi.fn(() => query),
    } as unknown as E2EAdminClient

    await cleanupStaleDemoEventTypes(adminClient, 'profile-1')

    expect(adminClient.from).toHaveBeenCalledWith('event_types')
    expect(query.select).toHaveBeenCalledWith('id, title, slug')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'profile-1')
    expect(query.lt).toHaveBeenCalledWith(
      'created_at',
      '2026-05-24T06:00:00.000Z'
    )
  })
})

function createMaybeSingleQuery(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  }

  return query
}
