import { NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { createAdminBackendClient } from '@/lib/backend/server'
import { revokeMcpApiToken } from '@/lib/mcp/tokens'

export const runtime = 'edge'

interface McpTokenRouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(
  _request: Request,
  { params }: McpTokenRouteContext
) {
  try {
    const auth = await getAuthenticatedProfile()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const { id } = await params
    const revoked = await revokeMcpApiToken({
      adminClient: createAdminBackendClient(),
      profileId: auth.profileId,
      tokenId: id,
    })

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: 'MCP token not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/mcp/tokens/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
