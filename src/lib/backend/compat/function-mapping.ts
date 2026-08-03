import { backendFunctionSlugs } from '../functions'

export function mapRpcToFunction(
  name: string,
  params: Record<string, unknown>
) {
  switch (name) {
    case 'confirm_booking':
      // The SQL function public.confirm_booking (migration
      // 20260526120000_add_confirm_cancel_booking_functions.sql) reads
      // event_type.location_type, location_value, video_provider, and
      // reminder policy directly from event_types; the lib no longer
      // forwards them through the RPC. Forward only the slim arg set.
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
        },
      }
    case 'cancel_booking':
      // The SQL function public.cancel_booking requires p_actor_type and
      // p_actor_id so the booking_events audit row records the correct
      // actor. The route handler passes actorType='host' and actorId=profileId
      // for authenticated host cancellations; the lib defaults to
      // actorType='guest', actorId=null for guest cancellations. These two
      // fields MUST be forwarded here, otherwise the function sees NULL for
      // the actor and the audit row is misattributed (or the function
      // raises invalid_actor_type).
      return {
        slug: backendFunctionSlugs.cancelBooking,
        serviceRole: true,
        body: {
          cancellationToken: params.p_cancellation_token,
          cancelReason: params.p_cancel_reason,
          actorType: params.p_actor_type,
          actorId: params.p_actor_id,
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
    case 'refresh_provider_token':
      return {
        slug: backendFunctionSlugs.refreshProviderToken,
        serviceRole: true,
        body: {
          connectionId: params.p_connection_id,
          expectedUpdatedAt: params.p_expected_updated_at,
          accessTokenEncrypted: params.p_access_token_encrypted,
          refreshTokenEncrypted: params.p_refresh_token_encrypted,
          tokenExpiresAt: params.p_token_expires_at,
          scopes: params.p_scopes,
        },
      }
    case 'save_availability':
      return {
        slug: backendFunctionSlugs.saveAvailability,
        // This function uses Butterbase's platform-verified service caller
        // identity instead of the legacy custom function bearer secret.
        serviceRole: false,
        body: {
          userId: params.p_user_id,
          scheduleId: params.p_schedule_id,
          expectedScheduleUpdatedAt: params.p_expected_schedule_updated_at,
          timezone: params.p_timezone,
          rules: params.p_rules,
          overrides: params.p_overrides,
          deletedRuleIds: params.p_deleted_rule_ids,
          deletedOverrideIds: params.p_deleted_override_ids,
        },
      }
    case 'save_dashboard_preferences':
      return {
        slug: backendFunctionSlugs.saveDashboardPreferences,
        // This function uses Butterbase's platform-verified service caller
        // identity instead of the legacy custom function bearer secret.
        serviceRole: false,
        body: {
          profileId: params.p_profile_id,
          defaultTimezone: params.p_default_timezone,
          dateFormat: params.p_date_format,
          timeFormat: params.p_time_format,
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
    // The SQL function public.cancel_booking returns TABLE(booking_id UUID).
    // Butterbase wraps the row in a camelCase object, so the runtime result
    // looks like { bookingId: '...' }. Normalize back to snake_case for
    // lib callers that read the returned booking id.
    if (Array.isArray(result)) {
      return result.map((row) => {
        const r = row as Record<string, unknown>
        return { booking_id: r.bookingId ?? r.booking_id }
      })
    }
    const r = result as Record<string, unknown> | null
    if (r === null) return [{ success: true }]
    return [{ booking_id: r.bookingId ?? r.booking_id }]
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
