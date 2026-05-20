import type { Database, InsertTables, Tables, UpdateTables } from '@/lib/types/database'

export type BackendProvider = 'butterbase' | 'insforge' | 'fake'

export const backendTables = [
  'profiles',
  'user_settings',
  'provider_connections',
  'provider_calendars',
  'provider_watches',
  'external_busy_cache',
  'calendar_event_refs',
  'webhook_endpoints',
  'webhook_deliveries',
  'event_types',
  'schedules',
  'availability_rules',
  'availability_overrides',
  'slot_holds',
  'host_reservations',
  'bookings',
  'booking_events',
  'contacts',
  'request_idempotency',
  'public_rate_limits',
  'outbox_events',
] as const satisfies ReadonlyArray<keyof Database['public']['Tables']>

export type BackendTable = (typeof backendTables)[number]
export type BackendRow<TTable extends BackendTable> = Tables<TTable>
export type BackendInsert<TTable extends BackendTable> = InsertTables<TTable>
export type BackendUpdate<TTable extends BackendTable> = UpdateTables<TTable>

export const providerTableMappings = {
  butterbase: Object.fromEntries(
    backendTables.map((table) => [table, table])
  ) as Record<BackendTable, string>,
  insforge: Object.fromEntries(
    backendTables.map((table) => [table, table])
  ) as Record<BackendTable, string>,
} as const

export const userOwnedTables = {
  profiles: 'auth_user_id',
  user_settings: 'profile_id',
  provider_connections: 'profile_id',
  event_types: 'user_id',
  schedules: 'user_id',
  availability_rules: 'user_id',
  availability_overrides: 'user_id',
  bookings: 'host_user_id',
  booking_events: 'host_user_id',
  contacts: 'host_user_id',
  webhook_endpoints: 'profile_id',
} as const satisfies Partial<Record<BackendTable, string>>
