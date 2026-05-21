import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  eventTypeFieldErrors,
  eventTypeWritePayload,
  getAuthenticatedProfile,
  isDuplicateSlugError,
  parseEventTypeBody,
  scheduleBelongsToProfile,
} from '../event-type-route-utils'

interface EventTypeRouteContext {
  params: Promise<{ id: string }>
}

/**
 * Updates an event type only when it belongs to the authenticated profile.
 * The route reuses the creation schema so create/edit forms share validation and
 * duplicate slug handling.
 */
export const runtime = 'edge'

export async function PATCH(
  request: NextRequest,
  { params }: EventTypeRouteContext
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const auth = await getAuthenticatedProfile(supabase)

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

    const parsed = parseEventTypeBody(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: eventTypeFieldErrors(parsed.error),
        },
        { status: 400 }
      )
    }

    const scheduleResult = await scheduleBelongsToProfile(
      supabase,
      parsed.data.schedule_id,
      auth.profile.id
    )

    if (!scheduleResult.ok) {
      return NextResponse.json(
        { success: false, error: scheduleResult.error },
        { status: scheduleResult.status }
      )
    }

    const { user_id: _userId, ...payload } = eventTypeWritePayload(
      parsed.data,
      auth.profile.id
    )

    const { data: eventType, error } = await (supabase
      .from('event_types') as any)
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', auth.profile.id)
      .select('id, slug')
      .single()

    if (error) {
      if (isDuplicateSlugError(error)) {
        return NextResponse.json(
          {
            success: false,
            error: 'This URL slug is already used by one of your event types.',
            details: {
              slug: ['This URL slug is already used by one of your event types.'],
            },
          },
          { status: 409 }
        )
      }

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Event type not found' },
          { status: 404 }
        )
      }

      console.error('Error updating event type:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update event type' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, eventType })
  } catch (error) {
    console.error('Error in PATCH /api/event-types/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Deletes an event type scoped to the authenticated profile.
 * maybeSingle lets the route distinguish a missing/foreign id from a database
 * failure without exposing ownership details.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: EventTypeRouteContext
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const auth = await getAuthenticatedProfile(supabase)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const { data: deletedEventType, error } = await (supabase
      .from('event_types') as any)
      .delete()
      .eq('id', id)
      .eq('user_id', auth.profile.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Error deleting event type:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete event type' },
        { status: 500 }
      )
    }

    if (!deletedEventType) {
      return NextResponse.json(
        { success: false, error: 'Event type not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/event-types/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
