import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import { createAdminBackendClient } from '@/lib/backend/server'
import { parseJsonBody } from '@/lib/http/json'
import { webhookEndpointSchema } from '@/lib/validations/webhooks'
import {
  listWebhookEndpointSummaries,
  toWebhookEndpointSummary,
} from '@/lib/webhooks/endpoints'
import type { Tables } from '@/lib/types/database'

/**
 * Returns safe webhook endpoint summaries for the authenticated profile.
 * Signing secrets are deliberately omitted after creation.
 */
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
      endpoints: await listWebhookEndpointSummaries(
        createAdminBackendClient(),
        auth.profileId
      ),
    })
  } catch (error) {
    console.error('Error in GET /api/webhooks/endpoints:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Creates a webhook endpoint for the current profile.
 * The signing secret is returned only in this creation response; list/update
 * endpoints intentionally expose only safe endpoint metadata.
 */
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

    const parsed = webhookEndpointSchema.safeParse(body.body)

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

    const { data, error } = await createAdminBackendClient()
      .from('webhook_endpoints')
      .insert({
        profile_id: auth.profileId,
        url: parsed.data.url,
        description: parsed.data.description ?? '',
        subscribed_events: parsed.data.subscribedEvents,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Webhook endpoint already exists' },
          { status: 409 }
        )
      }

      console.error('Error creating webhook endpoint:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create webhook endpoint' },
        { status: 500 }
      )
    }

    const endpoint = data as Tables<'webhook_endpoints'>

    return NextResponse.json(
      {
        success: true,
        endpoint: toWebhookEndpointSummary(endpoint),
        secretToken: endpoint.secret_token,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/webhooks/endpoints:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
