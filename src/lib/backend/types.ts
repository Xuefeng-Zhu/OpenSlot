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
