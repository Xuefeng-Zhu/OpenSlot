import type { z } from 'zod'
import type { Tables } from '@/lib/types/database'
import {
  parseEventTypeValues,
  type EventTypeFormValues,
} from '@/lib/validations/event-type'

type ProfileLookupClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null }
      error: unknown
    }>
  }
  from: (table: 'profiles') => any
}

type AuthenticatedProfileResult =
  | {
      ok: true
      profile: Pick<Tables<'profiles'>, 'id'>
    }
  | {
      ok: false
      error: string
      status: number
    }

/**
 * Resolves the current auth session to the profile id used by event type routes.
 * Returning status-bearing results keeps route handlers responsible for HTTP
 * responses while sharing the session/profile lookup.
 */
export async function getAuthenticatedProfile(
  supabase: ProfileLookupClient
): Promise<AuthenticatedProfileResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: 'Unauthorized', status: 401 }
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  const profile = profileData as Pick<Tables<'profiles'>, 'id'> | null

  if (!profile) {
    return {
      ok: false,
      error: 'Profile not found. Please complete onboarding first.',
      status: 404,
    }
  }

  return { ok: true, profile }
}

/**
 * Parses unknown JSON using the shared event type schema.
 */
export function parseEventTypeBody(body: unknown) {
  return parseEventTypeValues(body)
}

/**
 * Converts Zod event type errors into the field-error shape returned by routes.
 */
export function eventTypeFieldErrors(
  error: z.ZodError<EventTypeFormValues>
) {
  return error.flatten().fieldErrors
}

/**
 * Converts validated event type form values into the database write shape.
 * Optional text fields are normalized to empty strings to match existing table
 * defaults and keep PATCH/POST route behavior consistent.
 */
export function eventTypeWritePayload(
  data: EventTypeFormValues,
  userId: string
) {
  const isGeneratedVideo = data.location_type === 'video_provider'

  return {
    user_id: userId,
    title: data.title,
    slug: data.slug,
    description: data.description ?? '',
    duration_minutes: data.duration_minutes,
    buffer_before_minutes: data.buffer_before_minutes,
    buffer_after_minutes: data.buffer_after_minutes,
    min_notice_minutes: data.min_notice_minutes,
    max_booking_days_ahead: data.max_booking_days_ahead,
    location_type: data.location_type,
    location_value: isGeneratedVideo ? '' : data.location_value ?? '',
    video_provider: isGeneratedVideo ? data.video_provider ?? null : null,
    invitee_questions: data.invitee_questions,
    is_active: data.is_active,
    reminder_enabled: data.reminder_enabled,
    reminder_minutes_before: data.reminder_minutes_before,
    reminder_guest_enabled: data.reminder_guest_enabled,
    reminder_host_enabled: data.reminder_host_enabled,
  }
}

/**
 * Detects unique-slug constraint failures across Supabase/Postgres error shapes.
 * Route handlers use this to return a field-level 409 instead of a generic write
 * failure when hosts reuse an event type URL slug.
 */
export function isDuplicateSlugError(error: { code?: string; message?: string }) {
  return (
    error.code === '23505' &&
    (error.message?.includes('unique_slug_per_user') ||
      error.message?.includes('slug'))
  )
}
