import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  eventTypeFieldErrors,
  eventTypeWritePayload,
  getAuthenticatedProfile,
  isDuplicateSlugError,
  parseEventTypeBody,
  scheduleBelongsToProfile,
} from './event-type-route-utils'

/**
 * Creates an event type owned by the authenticated profile.
 * Slug conflicts are mapped to field-level validation errors so the editor can
 * keep the rest of the submitted form state intact.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
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

    const { data: eventType, error } = await (supabase
      .from('event_types') as any)
      .insert(eventTypeWritePayload(parsed.data, auth.profile.id))
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

      console.error('Error creating event type:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create event type' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, eventType },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/event-types:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
