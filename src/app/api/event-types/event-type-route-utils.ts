import type { z } from 'zod'
import { getAuthenticatedProfile as getSharedAuthenticatedProfile } from '@/lib/auth/get-authenticated-profile'
import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Tables } from '@/lib/types/database'
import {
  parseEventTypeValues,
  type EventTypeFormValues,
} from '@/lib/validations/event-type'

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
  backendClient: BackendCompatClient
): Promise<AuthenticatedProfileResult> {
  const auth = await getSharedAuthenticatedProfile(backendClient)

  if (!auth.ok) {
    return {
      ok: false,
      error:
        auth.status === 404
          ? 'Profile not found. Please complete onboarding first.'
          : auth.error,
      status: auth.status,
    }
  }

  return { ok: true, profile: { id: auth.profileId } }
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
    schedule_id: data.schedule_id,
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

export async function scheduleBelongsToProfile(
  backendClient: { from: (table: 'schedules') => any },
  scheduleId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: 404 | 500; error: string }> {
  const { data, error } = await backendClient
    .from('schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { ok: false, status: 404, error: 'Schedule not found' }
    }

    return { ok: false, status: 500, error: 'Failed to verify schedule' }
  }

  if (!data) {
    return { ok: false, status: 404, error: 'Schedule not found' }
  }

  return { ok: true }
}

/**
 * Detects unique-slug constraint failures across backend/Postgres error shapes.
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
