import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, GET, OPTIONS, POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: { from: vi.fn() },
  auth: {
    tokenId: 'token-1',
    profileId: 'profile-1',
    scopes: ['mcp:read', 'mcp:write'],
  },
  authenticateMcpApiToken: vi.fn(),
  bearerTokenFromHeader: vi.fn(() => 'os_mcp_token'),
  listMcpToolsForScopes: vi.fn(() => [
    {
      name: 'openslot_get_profile',
      description: 'Get profile',
      inputSchema: { type: 'object' },
    },
  ]),
  callMcpTool: vi.fn(),
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
}))

vi.mock('@/lib/mcp/tokens', () => ({
  authenticateMcpApiToken: mocks.authenticateMcpApiToken,
  bearerTokenFromHeader: mocks.bearerTokenFromHeader,
}))

vi.mock('@/lib/mcp/tools', () => ({
  listMcpToolsForScopes: mocks.listMcpToolsForScopes,
  callMcpTool: mocks.callMcpTool,
}))

function rpcRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer os_mcp_token',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticateMcpApiToken.mockResolvedValue(mocks.auth)
    mocks.callMcpTool.mockResolvedValue({
      content: [{ type: 'text', text: 'Loaded profile.' }],
      structuredContent: { profile: { id: 'profile-1' } },
    })
  })

  it('requires bearer token authentication', async () => {
    mocks.authenticateMcpApiToken.mockResolvedValue(null)

    const response = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer')
    expect(data).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32001,
        message: 'Unauthorized',
      },
    })
  })

  it('returns initialize capabilities', async () => {
    const response = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.result.protocolVersion).toBe('2025-06-18')
    expect(data.result.capabilities.tools).toEqual({ listChanged: false })
    expect(data.result.serverInfo.name).toBe('OpenSlot MCP')
  })

  it('lists tools for the authenticated token scopes', async () => {
    const response = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.listMcpToolsForScopes).toHaveBeenCalledWith([
      'mcp:read',
      'mcp:write',
    ])
    expect(data.result.tools[0].name).toBe('openslot_get_profile')
  })

  it('dispatches tool calls with arguments', async () => {
    const response = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'openslot_get_profile',
          arguments: {},
        },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.callMcpTool).toHaveBeenCalledWith({
      name: 'openslot_get_profile',
      argumentsValue: {},
      context: {
        adminClient: mocks.adminClient,
        auth: mocks.auth,
        request: expect.any(Request),
      },
    })
    expect(data.result.structuredContent.profile.id).toBe('profile-1')
  })

  it('returns a JSON-RPC internal error when a tool call throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    mocks.callMcpTool.mockRejectedValue(new Error('database unavailable'))

    const response = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        id: 'tool-error',
        method: 'tools/call',
        params: {
          name: 'openslot_get_profile',
          arguments: {},
        },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      jsonrpc: '2.0',
      id: 'tool-error',
      error: {
        code: -32603,
        message: 'Internal error',
      },
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Unhandled MCP tool call error',
      expect.objectContaining({
        toolName: 'openslot_get_profile',
        error: expect.any(Error),
      })
    )

    consoleError.mockRestore()
  })

  it('returns JSON-RPC invalid params for malformed tool calls', async () => {
    const response = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          arguments: {},
        },
      }) as any
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.error).toEqual({
      code: -32602,
      message: 'tools/call requires a tool name',
    })
    expect(mocks.callMcpTool).not.toHaveBeenCalled()
  })

  it('accepts initialized notifications without a response body', async () => {
    const response = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }) as any
    )

    expect(response.status).toBe(202)
    expect(await response.text()).toBe('')
  })

  it('returns structured errors for unknown methods and parse failures', async () => {
    const unknownResponse = await POST(
      rpcRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'unknown/method',
      }) as any
    )
    const unknownData = await unknownResponse.json()

    expect(unknownData.error.code).toBe(-32601)

    const parseResponse = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }) as any
    )
    const parseData = await parseResponse.json()

    expect(parseData.error).toEqual({
      code: -32700,
      message: 'Parse error',
    })
  })
})

describe('/api/mcp method handling', () => {
  it('handles preflight and unsupported HTTP methods', async () => {
    const optionsResponse = await OPTIONS()
    expect(optionsResponse.status).toBe(204)
    expect(optionsResponse.headers.get('Access-Control-Allow-Methods')).toBe(
      'POST, OPTIONS'
    )

    const getResponse = await GET()
    expect(getResponse.status).toBe(405)
    expect(getResponse.headers.get('Allow')).toBe('POST, OPTIONS')

    const deleteResponse = await DELETE()
    expect(deleteResponse.status).toBe(405)
  })
})
