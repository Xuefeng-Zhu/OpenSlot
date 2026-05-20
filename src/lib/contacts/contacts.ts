import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import { sha256Hex } from '@/lib/security/edge-crypto'
import type { Database, Tables } from '@/lib/types/database'

export interface ContactBookingInput {
  bookingId: string
  hostUserId: string
  guestName: string
  guestEmail: string
  guestTimezone: string
  occurredAt?: string
}

export interface ContactTouchInput {
  hostUserId: string
  guestEmail: string
  occurredAt?: string
}

export interface AnonymizeContactInput {
  contactId: string
  hostUserId: string
}

/**
 * Normalizes a guest email for deterministic, host-scoped contact identity.
 */
export function normalizeContactEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Hashes the normalized email so contacts can recognize repeat guests without
 * storing another raw email column alongside booking guest details.
 */
export function hashContactEmail(email: string): string {
  return sha256Hex(normalizeContactEmail(email))
}

/**
 * Creates or refreshes the active contact record for a confirmed booking.
 * Contact sync is intentionally best-effort: callers should not fail a booking
 * lifecycle transition solely because this derived aggregate could not update.
 */
export async function upsertContactFromBooking(
  adminClient: BackendCompatClient<Database>,
  input: ContactBookingInput
): Promise<Tables<'contacts'> | null> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const emailHash = hashContactEmail(input.guestEmail)
  const displayName = input.guestName.trim() || null

  const { data: existing, error: lookupError } = await adminClient
    .from('contacts')
    .select('id, first_seen_at')
    .eq('host_user_id', input.hostUserId)
    .eq('email_hash', emailHash)
    .maybeSingle()

  if (lookupError) {
    logContactError('lookup', lookupError, input.hostUserId)
    return null
  }

  if (existing) {
    const { data, error } = await adminClient
      .from('contacts')
      .update({
        display_name: displayName,
        last_guest_timezone: input.guestTimezone,
        last_seen_at: occurredAt,
        last_booking_id: input.bookingId,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) {
      logContactError('update', error, input.hostUserId)
      return null
    }

    return data as Tables<'contacts'>
  }

  const { data, error } = await adminClient
    .from('contacts')
    .insert({
      host_user_id: input.hostUserId,
      email_hash: emailHash,
      display_name: displayName,
      last_guest_timezone: input.guestTimezone,
      first_seen_at: occurredAt,
      last_seen_at: occurredAt,
      last_booking_id: input.bookingId,
    })
    .select('*')
    .single()

  if (error) {
    logContactError('insert', error, input.hostUserId)
    return null
  }

  return data as Tables<'contacts'>
}

/**
 * Records a non-confirmation lifecycle touch, such as cancellation, against an
 * existing active contact without reintroducing deleted contact metadata.
 */
export async function touchContactForBookingEvent(
  adminClient: BackendCompatClient<Database>,
  input: ContactTouchInput
): Promise<boolean> {
  const { error } = await adminClient
    .from('contacts')
    .update({
      last_seen_at: input.occurredAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('host_user_id', input.hostUserId)
    .eq('email_hash', hashContactEmail(input.guestEmail))
    .is('deleted_at', null)

  if (error) {
    logContactError('touch', error, input.hostUserId)
    return false
  }

  return true
}

/**
 * Soft-anonymizes a host-owned contact and its matching booking display fields.
 */
export async function anonymizeContact(
  adminClient: BackendCompatClient<Database>,
  input: AnonymizeContactInput
): Promise<{ success: true; anonymizedBookings: number } | { success: false; error: string }> {
  const { data, error } = await adminClient.rpc('anonymize_contact_bookings', {
    p_contact_id: input.contactId,
    p_host_user_id: input.hostUserId,
  })

  if (error) {
    if (error.message?.includes('contact_not_found')) {
      return { success: false, error: 'Contact not found' }
    }

    logContactError('anonymize', error, input.hostUserId)
    return { success: false, error: 'Failed to anonymize contact' }
  }

  return {
    success: true,
    anonymizedBookings: typeof data === 'number' ? data : 0,
  }
}

function logContactError(
  operation: string,
  error: { code?: string; message?: string },
  hostUserId: string
) {
  console.error('Contact sync failed:', {
    operation,
    code: error.code,
    message: error.message,
    hostUserId,
  })
}
