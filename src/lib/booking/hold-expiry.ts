import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

export interface ExpireStaleHoldsResult {
  expiredHolds: number
  expiredReservations: number
}

/**
 * Expires stale slot holds and their reservation mirrors through one database
 * RPC so cleanup is repeatable from cron and safe under concurrent workers.
 */
export async function expireStaleSlotHolds({
  adminClient,
  limit,
}: {
  adminClient: SupabaseClient<Database>
  limit: number
}): Promise<ExpireStaleHoldsResult> {
  const { data, error } = await adminClient
    .rpc('expire_stale_slot_holds', { p_limit: limit })
    .single()

  if (error || !data) {
    console.error('Error expiring stale slot holds:', error)
    throw new Error('Failed to expire stale slot holds')
  }

  return {
    expiredHolds: data.expired_holds,
    expiredReservations: data.expired_reservations,
  }
}
