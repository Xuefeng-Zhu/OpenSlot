import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient } from '@/lib/backend/server'
import {
  callMcpTool,
  listMcpToolsForScopes,
  type McpToolResult,
} from '@/lib/mcp/tools'
import {
  authenticateMcpApiToken,
  bearerTokenFromHeader,
} from '@/lib/mcp/tokens'

export const runtime = 'edge'

const JSON_RPC_VERSION = '2.0'
const MCP_PROTOCOL_VERSION = '2025-06-18'

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method: string
  params?: unknown
}

interface JsonRpcErrorPayload {
  code: number
  message: string
  data?: unknown
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, content-type, mcp-protocol-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function GET() {
  return methodNotAllowed()
}

export async function DELETE() {
  return methodNotAllowed()
}

/**
 * Stateless MCP Streamable HTTP endpoint.
 * V1 supports JSON responses only; SSE sessions and resumability are not used.
 */
export async function POST(request: NextRequest) {
  let rpcRequest: JsonRpcRequest

  try {
    const body = await request.json()

    if (!isJsonRpcRequest(body)) {
      return jsonRpcError(null, {
        code: -32600,
        message: 'Invalid JSON-RPC request',
      })
    }

    rpcRequest = body
  } catch {
    return jsonRpcError(null, {
      code: -32700,
      message: 'Parse error',
    })
  }

  const adminClient = createAdminBackendClient()
  const auth = await authenticateMcpApiToken({
    adminClient,
    bearerToken: bearerTokenFromHeader(request.headers.get('authorization')),
  })

  if (!auth) {
    return jsonRpcError(
      rpcRequest.id ?? null,
      {
        code: -32001,
        message: 'Unauthorized',
      },
      401,
      { 'WWW-Authenticate': 'Bearer realm="OpenSlot MCP"' }
    )
  }

  if (rpcRequest.id === undefined) {
    return handleNotification(rpcRequest)
  }

  switch (rpcRequest.method) {
    case 'initialize':
      return jsonRpcResult(rpcRequest.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: 'OpenSlot MCP',
          version: '0.1.0',
        },
        instructions:
          'Use OpenSlot tools to read event types, check availability, and perform safe booking mutations for the authenticated host.',
      })

    case 'ping':
      return jsonRpcResult(rpcRequest.id, {})

    case 'tools/list':
      return jsonRpcResult(rpcRequest.id, {
        tools: listMcpToolsForScopes(auth.scopes),
      })

    case 'tools/call':
      return handleToolCall(rpcRequest, {
        adminClient,
        auth,
        request,
      })

    default:
      return jsonRpcError(rpcRequest.id, {
        code: -32601,
        message: `Method not found: ${rpcRequest.method}`,
      })
  }
}

async function handleToolCall(
  rpcRequest: JsonRpcRequest,
  context: Parameters<typeof callMcpTool>[0]['context']
) {
  const params = parseToolCallParams(rpcRequest.params)

  if (!params.ok) {
    return jsonRpcError(rpcRequest.id ?? null, {
      code: -32602,
      message: params.error,
    })
  }

  let result: McpToolResult

  try {
    result = await callMcpTool({
      name: params.name,
      argumentsValue: params.argumentsValue,
      context,
    })
  } catch (error) {
    console.error('Unhandled MCP tool call error', {
      toolName: params.name,
      error,
    })
    return jsonRpcError(
      rpcRequest.id ?? null,
      {
        code: -32603,
        message: 'Internal error',
      },
      500
    )
  }

  return jsonRpcResult(rpcRequest.id ?? null, result)
}

function handleNotification(request: JsonRpcRequest) {
  if (request.method === 'notifications/initialized') {
    return new NextResponse(null, {
      status: 202,
      headers: corsHeaders,
    })
  }

  return new NextResponse(null, {
    status: 202,
    headers: corsHeaders,
  })
}

function parseToolCallParams(params: unknown):
  | { ok: true; name: string; argumentsValue: unknown }
  | { ok: false; error: string } {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return { ok: false, error: 'tools/call params must be an object' }
  }

  const record = params as Record<string, unknown>

  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    return { ok: false, error: 'tools/call requires a tool name' }
  }

  const argumentsValue =
    record.arguments === undefined ? {} : record.arguments

  if (
    typeof argumentsValue !== 'object' ||
    argumentsValue === null ||
    Array.isArray(argumentsValue)
  ) {
    return { ok: false, error: 'tools/call arguments must be an object' }
  }

  return {
    ok: true,
    name: record.name,
    argumentsValue,
  }
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  const id = record.id

  return (
    record.jsonrpc === JSON_RPC_VERSION &&
    typeof record.method === 'string' &&
    (id === undefined ||
      id === null ||
      typeof id === 'string' ||
      typeof id === 'number')
  )
}

function jsonRpcResult(id: JsonRpcId, result: Record<string, unknown> | McpToolResult) {
  return NextResponse.json(
    {
      jsonrpc: JSON_RPC_VERSION,
      id,
      result,
    },
    {
      status: 200,
      headers: protocolHeaders(),
    }
  )
}

function jsonRpcError(
  id: JsonRpcId,
  error: JsonRpcErrorPayload,
  status = 200,
  headers: Record<string, string> = {}
) {
  return NextResponse.json(
    {
      jsonrpc: JSON_RPC_VERSION,
      id,
      error,
    },
    {
      status,
      headers: {
        ...protocolHeaders(),
        ...headers,
      },
    }
  )
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    {
      status: 405,
      headers: {
        ...corsHeaders,
        Allow: 'POST, OPTIONS',
      },
    }
  )
}

function protocolHeaders() {
  return {
    ...corsHeaders,
    'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
  }
}
