import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureDemoAuthUser } from '../../../e2e/global-setup'
import { demoHost, resetRuntimeDemoHostForTests } from '../../../e2e/demo-data'
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
    resetRuntimeDemoHostForTests()
  })

  afterEach(() => {
    resetRuntimeDemoHostForTests()
    vi.unstubAllEnvs()
    rmSync(runtimeDir, { recursive: true, force: true })
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
        signInWithPassword: vi.fn(async () => ({
          data: null,
          error: { message: 'Butterbase request failed with 401' },
        })),
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

function createMaybeSingleQuery(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  }

  return query
}
