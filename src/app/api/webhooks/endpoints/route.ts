import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { webhookEndpointSchema } from '@/lib/validations/webhooks'
import {
  listWebhookEndpointSummaries,
  toWebhookEndpointSummary,
} from '@/lib/webhooks/endpoints'
import type { Tables } from '@/lib/types/database'

/**
 * Resolves the current session to a profile id for webhook endpoint ownership.
 * Mutations still use the service-key client, so every write must scope by this
 * profile id instead of trusting client-provided ownership.
 */
async function getAuthenticatedProfileId() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false as const, status: 404, error: 'Profile not found' }
  }

  return { ok: true as const, profileId: (profile as { id: string }).id }
}

/**
 * Returns safe webhook endpoint summaries for the authenticated profile.
 * Signing secrets are deliberately omitted after creation.
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedProfileId()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    return NextResponse.json({
      success: true,
      endpoints: await listWebhookEndpointSummaries(
        createAdminClient(),
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
    const auth = await getAuthenticatedProfileId()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = webhookEndpointSchema.safeParse(body)

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

    const { data, error } = await createAdminClient()
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
