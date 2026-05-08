import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { webhookEndpointSchema } from '@/lib/validations/webhooks'
import type { Tables } from '@/lib/types/database'

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

export async function GET() {
  try {
    const auth = await getAuthenticatedProfileId()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const { data, error } = await createAdminClient()
      .from('webhook_endpoints')
      .select('id, url, description, subscribed_events, is_active, created_at, updated_at')
      .eq('profile_id', auth.profileId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading webhook endpoints:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to load webhook endpoints' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      endpoints: ((data ?? []) as Tables<'webhook_endpoints'>[]).map(
        safeEndpoint
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
        endpoint: safeEndpoint(endpoint),
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

function safeEndpoint(endpoint: Pick<
  Tables<'webhook_endpoints'>,
  | 'id'
  | 'url'
  | 'description'
  | 'subscribed_events'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
>) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    description: endpoint.description,
    subscribedEvents: endpoint.subscribed_events,
    isActive: endpoint.is_active,
    createdAt: endpoint.created_at,
    updatedAt: endpoint.updated_at,
  }
}
