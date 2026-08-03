import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import {
  randomBase64Url,
  sha256Hex,
} from '@/lib/security/edge-crypto'
import type { Database, Tables } from '@/lib/types/database'
import { z } from 'zod'

export const MCP_TOKEN_PREFIX = 'os_mcp_'
export const MCP_READ_SCOPE = 'mcp:read'
export const MCP_WRITE_SCOPE = 'mcp:write'
export const MCP_DEFAULT_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE] as const

export type McpScope = (typeof MCP_DEFAULT_SCOPES)[number]

export interface McpTokenSummary {
  id: string
  name: string
  tokenPrefix: string
  scopes: McpScope[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface McpTokenAuth {
  tokenId: string
  profileId: string
  scopes: McpScope[]
}

type McpTokenRow = Tables<'mcp_api_tokens'>

export const createMcpTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z
    .array(z.enum(MCP_DEFAULT_SCOPES))
    .min(1)
    .optional()
    .default([...MCP_DEFAULT_SCOPES]),
  expiresAt: z.string().datetime().nullable().optional(),
})

export type CreateMcpTokenInput = z.infer<typeof createMcpTokenSchema>

export function generateMcpApiToken() {
  const token = `${MCP_TOKEN_PREFIX}${randomBase64Url(32)}`

  return {
    token,
    tokenHash: hashMcpApiToken(token),
    tokenPrefix: token.slice(0, 18),
  }
}

export function hashMcpApiToken(token: string) {
  return sha256Hex(`openslot:mcp-api-token:v1:${token}`)
}

export function bearerTokenFromHeader(value: string | null): string | null {
  if (!value) return null

  const match = value.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export async function createMcpApiToken({
  adminClient,
  profileId,
  input,
}: {
  adminClient: BackendCompatClient<Database>
  profileId: string
  input: CreateMcpTokenInput
}): Promise<{ summary: McpTokenSummary; token: string }> {
  const tokenParts = generateMcpApiToken()
  const scopes = normalizeScopes(input.scopes)

  if (scopes.length === 0) {
    throw new Error('MCP token requires at least one supported scope')
  }

  const now = new Date().toISOString()
  const { data, error } = await adminClient
    .from('mcp_api_tokens')
    .insert({
      profile_id: profileId,
      name: input.name.trim(),
      token_hash: tokenParts.tokenHash,
      token_prefix: tokenParts.tokenPrefix,
      scopes,
      expires_at: input.expiresAt ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create MCP token')
  }

  return {
    summary: toMcpTokenSummary(data as McpTokenRow),
    token: tokenParts.token,
  }
}

export async function listMcpTokenSummaries(
  adminClient: BackendCompatClient<Database>,
  profileId: string
): Promise<McpTokenSummary[]> {
  const { data, error } = await adminClient
    .from('mcp_api_tokens')
    .select(
      'id, profile_id, name, token_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, updated_at'
    )
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load MCP tokens: ${error.message}`)
  }

  return ((data ?? []) as McpTokenRow[]).map(toMcpTokenSummary)
}

export async function revokeMcpApiToken({
  adminClient,
  profileId,
  tokenId,
}: {
  adminClient: BackendCompatClient<Database>
  profileId: string
  tokenId: string
}): Promise<boolean> {
  const now = new Date().toISOString()
  const { data, error } = await adminClient
    .from('mcp_api_tokens')
    .update({ revoked_at: now, updated_at: now })
    .eq('id', tokenId)
    .eq('profile_id', profileId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to revoke MCP token: ${error.message}`)
  }

  return Boolean(data)
}

export async function authenticateMcpApiToken({
  adminClient,
  bearerToken,
  now = new Date(),
}: {
  adminClient: BackendCompatClient<Database>
  bearerToken: string | null
  now?: Date
}): Promise<McpTokenAuth | null> {
  if (!bearerToken || !bearerToken.startsWith(MCP_TOKEN_PREFIX)) {
    return null
  }

  const { data, error } = await adminClient
    .from('mcp_api_tokens')
    .select('id, profile_id, scopes, expires_at, revoked_at')
    .eq('token_hash', hashMcpApiToken(bearerToken))
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const token = data as Pick<
    McpTokenRow,
    'id' | 'profile_id' | 'scopes' | 'expires_at' | 'revoked_at'
  >

  if (token.revoked_at) {
    return null
  }

  if (token.expires_at && new Date(token.expires_at) <= now) {
    return null
  }

  const scopes = normalizeScopes(token.scopes)
  if (scopes.length === 0) {
    return null
  }

  await adminClient
    .from('mcp_api_tokens')
    .update({ last_used_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', token.id)

  return {
    tokenId: token.id,
    profileId: token.profile_id,
    scopes,
  }
}

export function toMcpTokenSummary(token: Pick<
  McpTokenRow,
  | 'id'
  | 'name'
  | 'token_prefix'
  | 'scopes'
  | 'last_used_at'
  | 'expires_at'
  | 'revoked_at'
  | 'created_at'
  | 'updated_at'
>): McpTokenSummary {
  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.token_prefix,
    scopes: normalizeScopes(token.scopes),
    lastUsedAt: token.last_used_at,
    expiresAt: token.expires_at,
    revokedAt: token.revoked_at,
    createdAt: token.created_at,
    updatedAt: token.updated_at,
  }
}

function normalizeScopes(scopes: readonly string[] | null | undefined): McpScope[] {
  const valid = new Set<string>(MCP_DEFAULT_SCOPES)
  return Array.from(
    new Set((scopes ?? []).filter((scope) => valid.has(scope)))
  ) as McpScope[]
}
