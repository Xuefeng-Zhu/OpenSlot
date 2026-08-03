import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { createAdminBackendClient } from '@/lib/backend/server'
import { parseJsonBody } from '@/lib/http/json'
import {
  createMcpApiToken,
  createMcpTokenSchema,
  listMcpTokenSummaries,
} from '@/lib/mcp/tokens'

export const runtime = 'edge'

export async function GET() {
  try {
    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    return NextResponse.json({
      success: true,
      tokens: await listMcpTokenSummaries(
        createAdminBackendClient(),
        auth.profileId
      ),
    })
  } catch (error) {
    console.error('Error in GET /api/mcp/tokens:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'MCP tokens are temporarily unavailable',
        code: 'MCP_TOKENS_UNAVAILABLE',
      },
      { status: 503 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const body = await parseJsonBody(request)
    if (!body.ok) return body.response

    const parsed = createMcpTokenSchema.safeParse(body.body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const created = await createMcpApiToken({
      adminClient: createAdminBackendClient(),
      profileId: auth.profileId,
      input: parsed.data,
    })

    return NextResponse.json(
      {
        success: true,
        token: created.summary,
        rawToken: created.token,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/mcp/tokens:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'MCP tokens are temporarily unavailable',
        code: 'MCP_TOKENS_UNAVAILABLE',
      },
      { status: 503 }
    )
  }
}
