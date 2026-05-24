import { backendFunctionSlugs } from '../functions'
import type { BackendFunctionName } from '../ports'
import type { ButterbaseHttpClient } from '../butterbase/http-client'
import { requestAsCompat } from './responses'
import type { BackendCompatResponse } from './types'

export async function invokeCompatFunction<TResponse = { success: true }>(
  httpClient: ButterbaseHttpClient,
  name: BackendFunctionName | 'deleteAuthUser' | 'updateAuthUser',
  body: unknown
): Promise<BackendCompatResponse<TResponse>> {
  const slug =
    name in backendFunctionSlugs
      ? backendFunctionSlugs[name as BackendFunctionName]
      : kebabCase(name)

  return requestAsCompat<TResponse>(httpClient, {
    method: 'POST',
    path: `/v1/${httpClient.appId}/fn/${slug}`,
    auth: 'none',
    accessToken: httpClient.functionAccessToken(),
    body,
  })
}

export function mapRpcToFunction(
  name: string,
  params: Record<string, unknown>
) {
  switch (name) {
    case 'confirm_booking':
      return {
        slug: backendFunctionSlugs.confirmBooking,
        serviceRole: true,
        body: {
          holdToken: params.p_hold_token,
          guestName: params.p_guest_name,
          guestEmail: params.p_guest_email,
          guestTimezone: params.p_guest_timezone,
          notes: params.p_notes,
          answers: params.p_booking_answers,
          locationType: params.p_location_type,
          locationValue: params.p_location_value,
          conferenceProvider: params.p_conference_provider,
          conferenceStatus: params.p_conference_status,
        },
      }
    case 'cancel_booking':
      return {
        slug: backendFunctionSlugs.cancelBooking,
        serviceRole: true,
        body: {
          cancellationToken: params.p_cancellation_token,
          cancelReason: params.p_cancel_reason,
        },
      }
    case 'create_slot_hold_with_reservation':
      return {
        slug: backendFunctionSlugs.createSlotHold,
        serviceRole: true,
        body: {
          eventTypeId: params.p_event_type_id,
          hostUserId: params.p_host_user_id,
          startAt: params.p_start_at,
          endAt: params.p_end_at,
          guestEmail: params.p_guest_email,
          expiresAt: params.p_expires_at,
        },
      }
    case 'reschedule_booking_with_hold':
      return {
        slug: backendFunctionSlugs.rescheduleBooking,
        serviceRole: true,
        body: {
          rescheduleToken: params.p_reschedule_token,
          holdToken: params.p_hold_token,
          guestName: params.p_guest_name,
          guestEmail: params.p_guest_email,
          guestTimezone: params.p_guest_timezone,
          notes: params.p_notes,
          answers: params.p_booking_answers,
        },
      }
    case 'claim_outbox_events':
      return {
        slug: backendFunctionSlugs.claimOutboxEvents,
        serviceRole: true,
        body: {
          limit: params.p_limit,
          maxAttempts: params.p_max_attempts,
        },
      }
    case 'claim_webhook_deliveries':
      return {
        slug: backendFunctionSlugs.claimWebhookDeliveries,
        serviceRole: true,
        body: {
          limit: params.p_limit,
          maxAttempts: params.p_max_attempts,
        },
      }
    case 'consume_public_rate_limit':
      return {
        slug: backendFunctionSlugs.consumePublicRateLimit,
        serviceRole: true,
        body: {
          scope: params.p_scope,
          identifierHash: params.p_identifier_hash,
          limit: params.p_limit_count,
          windowSeconds: params.p_window_seconds,
        },
      }
    case 'expire_stale_slot_holds':
      return {
        slug: backendFunctionSlugs.expireStaleSlotHolds,
        serviceRole: true,
        body: { limit: params.p_limit },
      }
    case 'save_availability':
      return {
        slug: backendFunctionSlugs.saveAvailability,
        serviceRole: true,
        body: {
          userId: params.p_user_id,
          scheduleId: params.p_schedule_id,
          timezone: params.p_timezone,
          rules: params.p_rules,
          overrides: params.p_overrides,
          deletedRuleIds: params.p_deleted_rule_ids,
          deletedOverrideIds: params.p_deleted_override_ids,
        },
      }
    case 'set_default_schedule':
      return {
        slug: 'set-default-schedule',
        serviceRole: true,
        body: {
          userId: params.p_user_id,
          scheduleId: params.p_schedule_id,
        },
      }
    case 'anonymize_contact_bookings':
      return {
        slug: 'anonymize-contact-bookings',
        serviceRole: true,
        body: {
          contactId: params.p_contact_id,
          hostUserId: params.p_host_user_id,
        },
      }
    default:
      return {
        slug: kebabCase(name),
        serviceRole: true,
        body: params,
      }
  }
}

export function normalizeRpcResult(name: string, result: unknown) {
  if (name === 'confirm_booking') {
    if (Array.isArray(result)) return result
    const row = result as Record<string, unknown>
    return [
      {
        booking_id: row.bookingId ?? row.booking_id,
        cancellation_token: row.cancellationToken ?? row.cancellation_token,
        reschedule_token: row.rescheduleToken ?? row.reschedule_token,
        conference_status: row.conferenceStatus ?? row.conference_status,
        conference_url: row.conferenceUrl ?? row.conference_url,
      },
    ]
  }

  if (name === 'cancel_booking') {
    if (Array.isArray(result)) return result
    return [result ?? { success: true }]
  }

  if (name === 'create_slot_hold_with_reservation') {
    const hold = result as Record<string, unknown>
    return [
      {
        hold_id: hold.holdId ?? hold.hold_id,
        hold_token: hold.holdToken ?? hold.hold_token,
        expires_at: hold.expiresAt ?? hold.expires_at,
      },
    ]
  }

  if (name === 'reschedule_booking_with_hold') {
    if (Array.isArray(result)) return result
    const row = result as Record<string, unknown>
    return [
      {
        old_booking_id: row.previousBookingId ?? row.old_booking_id,
        new_booking_id: row.bookingId ?? row.new_booking_id,
        event_type_id: row.eventTypeId ?? row.event_type_id,
        host_user_id: row.hostUserId ?? row.host_user_id,
        start_at: row.startAt ?? row.start_at,
        end_at: row.endAt ?? row.end_at,
        previous_start_at: row.previousStartAt ?? row.previous_start_at,
        previous_end_at: row.previousEndAt ?? row.previous_end_at,
        cancellation_token: row.cancellationToken ?? row.cancellation_token,
        reschedule_token: row.rescheduleToken ?? row.reschedule_token,
        conference_status: row.conferenceStatus ?? row.conference_status,
        conference_url: row.conferenceUrl ?? row.conference_url,
      },
    ]
  }

  if (name === 'anonymize_contact_bookings') {
    if (typeof result === 'number') return [result]
    if (result && typeof result === 'object') {
      return [(result as Record<string, unknown>).anonymizedBookings ?? 0]
    }
  }

  return Array.isArray(result) ? result : [result]
}

function kebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}
