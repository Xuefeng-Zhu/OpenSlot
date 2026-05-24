import { NextRequest, NextResponse } from 'next/server'
import { createAdminBackendClient, createServerBackendClient } from '@/lib/backend/server'
import { updateWebhookEndpointSchema } from '@/lib/validations/webhooks'

interface WebhookEndpointRouteProps {
  params: Promise<{ id: string }>
}

/**
 * Resolves the current session to a profile id for endpoint ownership checks.
 * Route handlers pair this with service-key writes so callers cannot update or
 * delete another profile's webhook endpoint by guessing an id.
 */
async function getAuthenticatedProfileId() {
  const backendClient = await createServerBackendClient()
  const {
    data: { user },
    error: authError,
  } = await backendClient.auth.getUser()

  if (authError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await backendClient
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
 * Applies a partial webhook endpoint update scoped to the current profile.
 * Undefined fields are ignored, while nullable description values normalize to
 * the empty string used by the database/UI contract.
 */
export const runtime = 'edge'

export async function PATCH(
  request: NextRequest,
  { params }: WebhookEndpointRouteProps
) {
  try {
    const auth = await getAuthenticatedProfileId()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const { id } = await params
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = updateWebhookEndpointSchema.safeParse(body)

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

    const updatePayload = {
      ...(parsed.data.url ? { url: parsed.data.url } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description ?? '' }
        : {}),
      ...(parsed.data.subscribedEvents
        ? { subscribed_events: parsed.data.subscribedEvents }
        : {}),
      ...(parsed.data.isActive !== undefined
        ? { is_active: parsed.data.isActive }
        : {}),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await createAdminBackendClient()
      .from('webhook_endpoints')
      .update(updatePayload)
      .eq('id', id)
      .eq('profile_id', auth.profileId)
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Webhook endpoint not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/webhooks/endpoints/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Deletes a webhook endpoint only when it belongs to the authenticated profile.
 * The route does not return whether a missing id belonged to another user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: WebhookEndpointRouteProps
) {
  try {
    const auth = await getAuthenticatedProfileId()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const { id } = await params
    const { error } = await createAdminBackendClient()
      .from('webhook_endpoints')
      .delete()
      .eq('id', id)
      .eq('profile_id', auth.profileId)

    if (error) {
      console.error('Error deleting webhook endpoint:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete webhook endpoint' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/webhooks/endpoints/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
