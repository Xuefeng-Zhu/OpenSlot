import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../route'
import { DELETE } from '../[id]/route'

const mocks = vi.hoisted(() => ({
  adminClient: { from: vi.fn() },
  getAuthenticatedProfile: vi.fn(),
  listMcpTokenSummaries: vi.fn(),
  createMcpApiToken: vi.fn(),
  revokeMcpApiToken: vi.fn(),
}))

vi.mock('@/lib/auth/get-authenticated-profile', () => ({
  getAuthenticatedProfile: mocks.getAuthenticatedProfile,
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/mcp/tokens', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mcp/tokens')>(
    '@/lib/mcp/tokens'
  )

  return {
    ...actual,
    listMcpTokenSummaries: mocks.listMcpTokenSummaries,
    createMcpApiToken: mocks.createMcpApiToken,
    revokeMcpApiToken: mocks.revokeMcpApiToken,
  }
})

const summary = {
  id: 'token-1',
  name: 'Claude Desktop',
  tokenPrefix: 'os_mcp_abcd1234',
  scopes: ['mcp:read', 'mcp:write'],
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: '2026-05-24T00:00:00.000Z',
  updatedAt: '2026-05-24T00:00:00.000Z',
}

function requestWithJson(body: unknown) {
  return new Request('http://localhost/api/mcp/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function requestWithMalformedJson() {
  return new Request('http://localhost/api/mcp/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
}

function routeContext(id = 'token-1') {
  return {
    params: Promise.resolve({ id }),
  }
}

describe('/api/mcp/tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthenticatedProfile.mockResolvedValue({
      ok: true,
      profileId: 'profile-1',
      userId: 'auth-user-1',
      email: 'host@example.com',
    })
    mocks.listMcpTokenSummaries.mockResolvedValue([summary])
    mocks.createMcpApiToken.mockResolvedValue({
      summary,
      token: 'os_mcp_raw-token',
    })
    mocks.revokeMcpApiToken.mockResolvedValue(true)
  })

  it('lists safe token summaries for the authenticated profile', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, tokens: [summary] })
    expect(mocks.listMcpTokenSummaries).toHaveBeenCalledWith(
      mocks.adminClient,
      'profile-1'
    )
    expect(JSON.stringify(data)).not.toContain('token_hash')
  })

  it('creates a token and returns the raw token only once', async () => {
    const response = await POST(
      requestWithJson({ name: 'Claude Desktop' }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual({
      success: true,
      token: summary,
      rawToken: 'os_mcp_raw-token',
    })
    expect(mocks.createMcpApiToken).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      profileId: 'profile-1',
      input: {
        name: 'Claude Desktop',
        scopes: ['mcp:read', 'mcp:write'],
      },
    })
  })

  it('returns validation errors for invalid create payloads', async () => {
    const response = await POST(requestWithJson({ name: '' }) as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.details.name).toBeDefined()
    expect(mocks.createMcpApiToken).not.toHaveBeenCalled()
  })

  it('returns the shared invalid JSON error for malformed create payloads', async () => {
    const response = await POST(requestWithMalformedJson() as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'Invalid JSON body',
    })
    expect(mocks.createMcpApiToken).not.toHaveBeenCalled()
  })

  it('revokes a token scoped to the authenticated profile', async () => {
    const response = await DELETE({} as any, routeContext())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mocks.revokeMcpApiToken).toHaveBeenCalledWith({
      adminClient: mocks.adminClient,
      profileId: 'profile-1',
      tokenId: 'token-1',
    })
  })

  it('rejects unauthenticated token requests', async () => {
    mocks.getAuthenticatedProfile.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toEqual({ success: false, error: 'Unauthorized' })
  })
})
