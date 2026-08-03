import { describe, expect, it, vi } from 'vitest'
import {
  authenticateMcpApiToken,
  createMcpApiToken,
  generateMcpApiToken,
  hashMcpApiToken,
  listMcpTokenSummaries,
  MCP_TOKEN_PREFIX,
  revokeMcpApiToken,
  toMcpTokenSummary,
} from '../tokens'

const tokenRow = {
  id: 'token-1',
  profile_id: 'profile-1',
  name: 'Claude Desktop',
  token_hash: 'hashed-token',
  token_prefix: 'os_mcp_abcd1234',
  scopes: ['mcp:read', 'mcp:write'],
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
  created_at: '2026-05-24T00:00:00.000Z',
  updated_at: '2026-05-24T00:00:00.000Z',
}

describe('MCP token helpers', () => {
  it('generates prefixed tokens and hashes without storing raw token material', () => {
    const generated = generateMcpApiToken()

    expect(generated.token).toMatch(new RegExp(`^${MCP_TOKEN_PREFIX}`))
    expect(generated.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(generated.tokenHash).toBe(hashMcpApiToken(generated.token))
    expect(generated.tokenHash).not.toContain(generated.token)
    expect(generated.tokenPrefix).toBe(generated.token.slice(0, 18))
  })

  it('maps safe summaries without exposing token hashes', () => {
    const summary = toMcpTokenSummary(tokenRow)

    expect(summary).toEqual({
      id: 'token-1',
      name: 'Claude Desktop',
      tokenPrefix: 'os_mcp_abcd1234',
      scopes: ['mcp:read', 'mcp:write'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z',
    })
    expect(JSON.stringify(summary)).not.toContain('token_hash')
    expect(JSON.stringify(summary)).not.toContain('hashed-token')
  })

  it('creates a token and returns the raw token only in the creation result', async () => {
    const insert = vi.fn((_payload: Record<string, unknown>) => ({
      select: () => ({
        single: async () => ({ data: tokenRow, error: null }),
      }),
    }))
    const adminClient = {
      from: vi.fn((table: string) => {
        expect(table).toBe('mcp_api_tokens')
        return { insert }
      }),
    } as any

    const result = await createMcpApiToken({
      adminClient,
      profileId: 'profile-1',
      input: {
        name: ' Claude Desktop ',
        scopes: ['mcp:read', 'mcp:write'],
      },
    })

    expect(result.token).toMatch(/^os_mcp_/)
    expect(result.summary.name).toBe('Claude Desktop')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 'profile-1',
        name: 'Claude Desktop',
        token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        token_prefix: expect.stringMatching(/^os_mcp_/),
      })
    )
  })

  it('lists summaries scoped to a profile', async () => {
    const adminClient = {
      from: vi.fn((table: string) => {
        expect(table).toBe('mcp_api_tokens')
        return {
          select: () => ({
            eq: (_column: string, profileId: string) => ({
              order: async () => ({
                data: [{ ...tokenRow, name: profileId }],
                error: null,
              }),
            }),
          }),
        }
      }),
    } as any

    await expect(
      listMcpTokenSummaries(adminClient, 'profile-1')
    ).resolves.toEqual([
      expect.objectContaining({
        name: 'profile-1',
        tokenPrefix: 'os_mcp_abcd1234',
      }),
    ])
  })

  it('revokes only tokens owned by the profile', async () => {
    const filters: Array<{ column: string; value: unknown }> = []
    const adminClient = {
      from: vi.fn(() => ({
        update: () => {
          const builder = {
            eq: (column: string, value: unknown) => {
              filters.push({ column, value })
              return builder
            },
            select: () => builder,
            maybeSingle: async () => ({ data: { id: 'token-1' }, error: null }),
          }
          return builder
        },
      })),
    } as any

    await expect(
      revokeMcpApiToken({
        adminClient,
        profileId: 'profile-1',
        tokenId: 'token-1',
      })
    ).resolves.toBe(true)
    expect(filters).toEqual([
      { column: 'id', value: 'token-1' },
      { column: 'profile_id', value: 'profile-1' },
    ])
  })

  it('authenticates active bearer tokens and updates last use', async () => {
    const rawToken = 'os_mcp_test-token'
    const updatePayloads: Record<string, unknown>[] = []
    const adminClient = {
      from: vi.fn(() => ({
        select: () => ({
          eq: (_column: string, value: string) => {
            expect(value).toBe(hashMcpApiToken(rawToken))
            return {
              maybeSingle: async () => ({
                data: {
                  id: 'token-1',
                  profile_id: 'profile-1',
                  scopes: ['mcp:read'],
                  expires_at: null,
                  revoked_at: null,
                },
                error: null,
              }),
            }
          },
        }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload)
          return {
            eq: () => Promise.resolve({ data: null, error: null }),
          }
        },
      })),
    } as any

    await expect(
      authenticateMcpApiToken({
        adminClient,
        bearerToken: rawToken,
        now: new Date('2026-05-24T00:00:00.000Z'),
      })
    ).resolves.toEqual({
      tokenId: 'token-1',
      profileId: 'profile-1',
      scopes: ['mcp:read'],
    })
    expect(updatePayloads[0]).toMatchObject({
      last_used_at: '2026-05-24T00:00:00.000Z',
    })
  })

  it('rejects expired or revoked tokens', async () => {
    const adminClient = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'token-1',
                profile_id: 'profile-1',
                scopes: ['mcp:read'],
                expires_at: '2026-05-23T00:00:00.000Z',
                revoked_at: null,
              },
              error: null,
            }),
          }),
        }),
      })),
    } as any

    await expect(
      authenticateMcpApiToken({
        adminClient,
        bearerToken: 'os_mcp_expired',
        now: new Date('2026-05-24T00:00:00.000Z'),
      })
    ).resolves.toBeNull()
  })

  it('fails closed when persisted scopes are empty or unsupported', async () => {
    const update = vi.fn()
    const adminClient = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'token-1',
                profile_id: 'profile-1',
                scopes: ['mcp:admin'],
                expires_at: null,
                revoked_at: null,
              },
              error: null,
            }),
          }),
        }),
        update,
      })),
    } as any

    await expect(
      authenticateMcpApiToken({
        adminClient,
        bearerToken: 'os_mcp_invalid-scope',
      })
    ).resolves.toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})
