import { describe, expect, it } from 'vitest'
import { mapRpcToFunction, normalizeRpcResult } from '../function-mapping'

describe('mapRpcToFunction', () => {
  describe('cancel_booking', () => {
    // Regression: the route handler at
    // src/app/api/bookings/[id]/cancel/route.ts passes actorType: 'host'
    // and actorId: profileId for authenticated host cancellations. The lib
    // at src/lib/booking/cancel.ts forwards these as p_actor_type and
    // p_actor_id to adminClient.rpc('cancel_booking', ...). This mapping
    // MUST forward them to the function body, otherwise the SQL function
    // sees NULL and either mis-attributes the booking_events audit row
    // (P0001 from the actor_type CHECK) or records no actor at all.

    it('forwards p_actor_type and p_actor_id for an authenticated host cancellation', () => {
      const result = mapRpcToFunction('cancel_booking', {
        p_cancellation_token: 'tok-host-1',
        p_cancel_reason: 'Schedule conflict',
        p_actor_type: 'host',
        p_actor_id: 'profile-1',
      })
      expect(result.slug).toBe('cancel-booking')
      expect(result.serviceRole).toBe(true)
      expect(result.body).toEqual({
        cancellationToken: 'tok-host-1',
        cancelReason: 'Schedule conflict',
        actorType: 'host',
        actorId: 'profile-1',
      })
    })

    it('forwards null actor fields for a guest cancellation (lib defaults)', () => {
      const result = mapRpcToFunction('cancel_booking', {
        p_cancellation_token: 'tok-guest-1',
        p_cancel_reason: null,
        p_actor_type: 'guest',
        p_actor_id: null,
      })
      expect(result.body).toEqual({
        cancellationToken: 'tok-guest-1',
        cancelReason: null,
        actorType: 'guest',
        actorId: null,
      })
    })

    it('forwards system actor fields when a future worker calls the lib', () => {
      const result = mapRpcToFunction('cancel_booking', {
        p_cancellation_token: 'tok-system-1',
        p_cancel_reason: 'expired',
        p_actor_type: 'system',
        p_actor_id: null,
      })
      expect(result.body).toEqual({
        cancellationToken: 'tok-system-1',
        cancelReason: 'expired',
        actorType: 'system',
        actorId: null,
      })
    })
  })

  describe('confirm_booking', () => {
    // The SQL function public.confirm_booking (migration
    // 20260526120000_add_confirm_cancel_booking_functions.sql) reads
    // event_type.location_type, location_value, video_provider, and
    // reminder policy directly from event_types. The lib at
    // src/lib/booking/confirm.ts passes only the slim 6-param set. The
    // mapping MUST NOT include the removed p_location_type,
    // p_location_value, p_conference_provider, p_conference_status keys
    // in the forwarded body — they would reach the function as undefined
    // and either be silently dropped or break the wrapper.

    it('forwards only the slim 6-param set (no stale location/conference keys)', () => {
      const result = mapRpcToFunction('confirm_booking', {
        p_hold_token: 'h-1',
        p_guest_name: 'Guest',
        p_guest_email: 'g@example.com',
        p_guest_timezone: 'UTC',
        p_notes: '',
        p_booking_answers: [],
      })
      expect(result.slug).toBe('confirm-booking')
      expect(result.serviceRole).toBe(true)
      expect(result.body).toEqual({
        holdToken: 'h-1',
        guestName: 'Guest',
        guestEmail: 'g@example.com',
        guestTimezone: 'UTC',
        notes: '',
        answers: [],
      })
      // Explicit: the removed keys are NOT in the forwarded body.
      expect(result.body).not.toHaveProperty('locationType')
      expect(result.body).not.toHaveProperty('locationValue')
      expect(result.body).not.toHaveProperty('conferenceProvider')
      expect(result.body).not.toHaveProperty('conferenceStatus')
    })
  })

  describe('save_dashboard_preferences', () => {
    it('maps the section-owned fields to the atomic Butterbase function', () => {
      const result = mapRpcToFunction('save_dashboard_preferences', {
        p_profile_id: '11111111-2222-4333-8444-555555555555',
        p_default_timezone: 'America/Los_Angeles',
        p_date_format: 'DD/MM/YYYY',
        p_time_format: '24h',
      })

      expect(result).toEqual({
        slug: 'save-dashboard-preferences',
        serviceRole: false,
        body: {
          profileId: '11111111-2222-4333-8444-555555555555',
          defaultTimezone: 'America/Los_Angeles',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
        },
      })
    })
  })

  describe('refresh_provider_token', () => {
    it('maps encrypted credentials to the atomic Butterbase function', () => {
      const result = mapRpcToFunction('refresh_provider_token', {
        p_connection_id: '11111111-2222-4333-8444-555555555555',
        p_expected_updated_at: '2026-08-03T17:00:00.000Z',
        p_access_token_encrypted: 'encrypted-access',
        p_refresh_token_encrypted: 'encrypted-refresh',
        p_token_expires_at: '2026-08-03T18:00:00.000Z',
        p_scopes: ['calendar.read'],
      })

      expect(result).toEqual({
        slug: 'refresh-provider-token',
        serviceRole: true,
        body: {
          connectionId: '11111111-2222-4333-8444-555555555555',
          expectedUpdatedAt: '2026-08-03T17:00:00.000Z',
          accessTokenEncrypted: 'encrypted-access',
          refreshTokenEncrypted: 'encrypted-refresh',
          tokenExpiresAt: '2026-08-03T18:00:00.000Z',
          scopes: ['calendar.read'],
        },
      })
    })
  })

  describe('resolve_webhook_hostname', () => {
    it('maps DNS validation to the protected Butterbase function', () => {
      const result = mapRpcToFunction('resolve_webhook_hostname', {
        p_hostname: 'hooks.example.com',
      })

      expect(result).toEqual({
        slug: 'resolve-webhook-hostname',
        serviceRole: true,
        body: { hostname: 'hooks.example.com' },
      })
    })
  })

  describe('save_availability', () => {
    it('maps host-owned rows to the atomic platform-authenticated function', () => {
      const result = mapRpcToFunction('save_availability', {
        p_user_id: '11111111-2222-4333-8444-555555555555',
        p_schedule_id: '22222222-3333-4444-8555-666666666666',
        p_timezone: 'America/Los_Angeles',
        p_rules: [
          {
            weekday: 1,
            start_time: '09:00',
            end_time: '17:00',
            is_active: true,
          },
        ],
        p_overrides: [],
        p_deleted_rule_ids: [],
        p_deleted_override_ids: [],
      })

      expect(result).toEqual({
        slug: 'save-availability',
        serviceRole: false,
        body: {
          userId: '11111111-2222-4333-8444-555555555555',
          scheduleId: '22222222-3333-4444-8555-666666666666',
          timezone: 'America/Los_Angeles',
          rules: [
            {
              weekday: 1,
              start_time: '09:00',
              end_time: '17:00',
              is_active: true,
            },
          ],
          overrides: [],
          deletedRuleIds: [],
          deletedOverrideIds: [],
        },
      })
    })
  })
})

describe('normalizeRpcResult', () => {
  describe('cancel_booking', () => {
    // The SQL function public.cancel_booking returns TABLE(booking_id
    // UUID). Butterbase wraps the row in a camelCase object, so the
    // runtime result is { bookingId: '...' }. Normalize back to
    // snake_case for lib callers that read the returned booking id.
    it('normalizes the camelCase single-row result to snake_case', () => {
      expect(normalizeRpcResult('cancel_booking', { bookingId: 'b-1' })).toEqual([
        { booking_id: 'b-1' },
      ])
    })

    it('passes through an already-snake_case single-row result', () => {
      expect(normalizeRpcResult('cancel_booking', { booking_id: 'b-2' })).toEqual([
        { booking_id: 'b-2' },
      ])
    })

    it('normalizes each row of an array result', () => {
      expect(
        normalizeRpcResult('cancel_booking', [{ bookingId: 'b-3' }])
      ).toEqual([{ booking_id: 'b-3' }])
    })

    it('falls back to { success: true } when the function returns null', () => {
      expect(normalizeRpcResult('cancel_booking', null)).toEqual([
        { success: true },
      ])
    })
  })
})
