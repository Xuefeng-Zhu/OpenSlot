# Architecture

OpenSlot is a Next.js App Router application with Supabase-backed persistence and server-first data loading for sensitive flows.

## High-Level Layers

```text
Browser UI
  -> Client Components for interaction and local form state
  -> Next route handlers for writes and public slot APIs
  -> Supabase clients
  -> Postgres tables, RLS, constraints, indexes
```

## Route Groups

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Public landing page. |
| `src/app/(auth)/login/page.tsx` | Supabase password login. |
| `src/app/(auth)/signup/page.tsx` | Supabase password signup. |
| `src/app/(dashboard)/layout.tsx` | Authenticated dashboard layout and shell. |
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard overview with profile, bookings, active event type count. |
| `src/app/(dashboard)/availability/page.tsx` | Server-fetched availability editor. |
| `src/app/(dashboard)/bookings/page.tsx` | Server-fetched bookings list. |
| `src/app/(dashboard)/contacts/*` | Host contact list and contact booking history derived from booking attendees. |
| `src/app/(dashboard)/profile/page.tsx` | Profile settings. |
| `src/app/(dashboard)/settings/page.tsx` | Server-loaded account, display, notification, calendar, and webhook integration settings. |
| `src/app/(dashboard)/onboarding/page.tsx` | Client onboarding flow that saves profile, availability, and first event type through `/api/onboarding`. |
| `src/app/(dashboard)/event-types/*` | Event type list/new/edit dashboard UI backed by Supabase and `/api/event-types`. |
| `src/app/(public)/[username]/page.tsx` | Public host profile and active event types. |
| `src/app/(public)/[username]/[eventSlug]/page.tsx` | Public booking flow shell. |
| `src/app/booking/cancel/[token]/page.tsx` | Public token-backed booking cancellation page. |
| `src/app/booking/reschedule/[token]/page.tsx` | Public token-backed booking rescheduling page. |
| `src/app/api/*` | Slot, hold, booking, cancellation, rescheduling, settings, calendar, webhook, event type, and availability APIs. |

## Data Access Patterns

- `src/lib/supabase/server.ts` creates a cookie-aware Supabase client for Server Components and route handlers.
- `src/lib/supabase/client.ts` creates the browser client for client components.
- `src/lib/supabase/admin.ts` creates a service role client for server-only writes that must bypass RLS.
- `src/proxy.ts` refreshes Supabase sessions. The dashboard route group also enforces auth in `src/app/(dashboard)/layout.tsx`.
- Direct Data API grants are explicit in migrations. Public booking pages and slot reads go through server-side service-role code; direct anon table access is not required.

## Booking Flow

```text
Public event page
  -> SlotPicker
  -> GET /api/slots
  -> load host availability, confirmed bookings, active holds, and provider busy cache
  -> computeAvailableSlots()
  -> POST /api/holds
  -> create_slot_hold_with_reservation()
  -> slot_holds insert + host_reservations insert
  -> BookingForm
  -> POST /api/bookings
  -> request_idempotency check/cache when an idempotency key is supplied
  -> confirmBooking()
  -> bookings insert + hold status update + host_reservations hold-to-booking conversion
  -> booking_events append
  -> contacts upsert from guest identity hash
  -> outbox_events enqueue for provider writes, notifications, and future webhooks
  -> GET/POST /api/outbox/process through Vercel Cron or an equivalent worker trigger
  -> claim_outbox_events()
  -> provider calendar event create/delete through Google Calendar or Microsoft Graph
  -> notification emails through the configured email provider
  -> tenant webhook delivery rows for subscribed endpoints
  -> GET/POST /api/webhooks/process through Vercel Cron or an equivalent worker trigger
  -> /booking/cancel/[token]
  -> POST /api/bookings/[id]/cancel
  -> request_idempotency check/cache when an idempotency key is supplied
  -> cancelBooking()
  -> host_reservations cancellation
  -> booking_events append
  -> contacts lifecycle touch
  -> outbox_events enqueue for provider updates, notifications, and future webhooks
  -> GET/POST /api/outbox/process through Vercel Cron or an equivalent worker trigger
  -> /booking/reschedule/[token]
  -> POST /api/holds for the replacement slot
  -> POST /api/bookings/reschedule
  -> reschedule_booking_with_hold()
  -> old booking status = rescheduled + new confirmed booking insert
  -> booking_events append + contacts upsert + outbox_events enqueue
```

The final anti-double-booking guard for confirmed bookings is the Postgres exclusion constraint in `supabase/migrations/007_create_bookings.sql`. Active hold and booking reservation races are guarded by `host_reservations_no_overlap` in `supabase/migrations/20260508062648_add_host_reservations.sql`.

## Availability Flow

```text
/availability server page
  -> fetch profile, rules, overrides
  -> AvailabilityClient
  -> local diff state
  -> POST /api/availability
  -> authenticated profile lookup
  -> service-role delete/update/insert scoped by user_id
```

Availability rules use database weekday values where `0 = Sunday` and `6 = Saturday`. The dashboard UI displays Monday first, so conversion helpers live in `src/components/dashboard/availability-client.tsx`.

## Onboarding Flow

```text
/onboarding client page
  -> validates profile, availability, and first event type locally
  -> POST /api/onboarding
  -> authenticated profile lookup
  -> service-role profile update + event type upsert + availability rule replacement
```

The onboarding API stores the browser timezone as the profile default timezone and the timezone for created weekly availability rules.

## Database Schema

Migrations are in `supabase/migrations/`:

- `001_enable_extensions.sql`: `uuid-ossp` and `btree_gist`.
- `002_create_profiles.sql`: profile records linked to `auth.users`.
- `003_create_event_types.sql`: event types and unique `(user_id, slug)`.
- `004_create_availability_rules.sql`: recurring weekly availability.
- `005_create_availability_overrides.sql`: date-specific availability exceptions.
- `006_create_slot_holds.sql`: short-lived holds.
- `007_create_bookings.sql`: bookings and exclusion constraint.
- `008_create_rls_policies.sql`: RLS policies.
- `009_create_indexes.sql`: lookup and performance indexes.
- `010_create_profile_trigger.sql`: profile creation trigger on auth signup.
- `20260508055906_add_request_idempotency.sql`: request replay ledger for booking mutations.
- `20260508061910_add_outbox_events.sql`: internal side-effect ledger with unique dedupe keys.
- `20260508062648_add_host_reservations.sql`: host reservation ledger, exclusion constraint, and hold-creation RPC.
- `20260508063319_add_explicit_data_api_grants.sql`: explicit Data API grants and removal of permissive guest-write RLS policies.
- `20260508064552_add_booking_events.sql`: append-only booking lifecycle event ledger.
- `20260508065512_add_outbox_claim_function.sql`: atomic outbox leasing RPC for workers.
- `20260508070314_add_user_settings.sql`: persisted dashboard display and notification settings.
- `20260508070850_add_booking_reschedule_flow.sql`: reschedule status columns and atomic reschedule RPC.
- `20260508071400_add_calendar_integration_foundation.sql`: server-only provider connection, calendar, watch, and busy-cache tables.
- `20260508071723_add_webhook_delivery_system.sql`: webhook endpoint, delivery queue, and atomic delivery leasing RPC.
- `20260508074740_add_calendar_event_refs.sql`: external calendar event reference rows for provider write/cancel retries.
- `20260512000000_add_contacts.sql`: host-scoped contact aggregate, backfill, RLS, and soft-anonymization RPC.

## API Routes

| Route | Auth | Main module |
| --- | --- | --- |
| `GET /api/slots` | Public route, service-role read after active host/event validation | `src/lib/availability/compute-slots.ts` |
| `POST /api/holds` | Public token/slot operation, service role RPC with reservation guard | `src/app/api/holds/route.ts` |
| `POST /api/bookings` | Hold token operation, optional idempotency key, service role write | `src/lib/booking/confirm.ts` |
| `POST /api/bookings/[id]/cancel` | Cancellation token operation, optional idempotency key, service role write | `src/lib/booking/cancel.ts` |
| `POST /api/bookings/reschedule` | Reschedule token + hold token operation, optional idempotency key, service role RPC | `src/lib/booking/reschedule.ts` |
| `DELETE /api/contacts/[id]` | Authenticated host contact anonymization scoped to own profile | `src/lib/contacts/contacts.ts` |
| `GET/POST /api/outbox/process` | Bearer-token worker trigger, service role write | `src/lib/outbox/process.ts` |
| `PATCH/DELETE /api/settings` | Authenticated host settings and account deletion | `src/app/api/settings/route.ts` |
| `GET /api/calendar/connections` | Authenticated host, safe server-side calendar connection summaries | `src/lib/calendar/connections.ts` |
| `GET /api/calendar/oauth/[provider]/start` | Authenticated host calendar OAuth redirect | `src/lib/calendar/oauth.ts` |
| `GET /api/calendar/oauth/[provider]/callback` | Authenticated host calendar OAuth callback | `src/lib/calendar/oauth.ts` |
| `GET/POST /api/calendar/sync` | Bearer-token provider calendar/busy-cache sync worker | `src/lib/calendar/provider-sync.ts` |
| `GET/POST /api/webhooks/endpoints` | Authenticated host webhook endpoint management | `src/app/api/webhooks/endpoints/route.ts` |
| `PATCH/DELETE /api/webhooks/endpoints/[id]` | Authenticated host webhook endpoint management scoped to own profile | `src/app/api/webhooks/endpoints/[id]/route.ts` |
| `GET/POST /api/webhooks/process` | Bearer-token webhook delivery worker trigger, service role write | `src/lib/webhooks/deliveries.ts` |
| `POST /api/onboarding` | Authenticated host setup | `src/app/api/onboarding/route.ts` |
| `POST /api/event-types` | Authenticated host | `src/app/api/event-types/route.ts` |
| `PATCH/DELETE /api/event-types/[id]` | Authenticated host, scoped to own profile | `src/app/api/event-types/[id]/route.ts` |
| `POST /api/availability` | Authenticated host | `src/app/api/availability/route.ts` |

## Current Gaps to Preserve in Docs

Detailed target/current gaps are tracked in [System Design Gap Analysis](system-design-gaps.md).

- `docs/system-design.md` describes public booking writes, provider callbacks, payment webhooks, and background integration boundaries as Supabase Edge Functions. The current implementation uses Next.js route handlers in `src/app/api/*` for those surfaces. This is acceptable for the MVP because it maximizes local code reuse and keeps deployment simple, but it couples high-risk public/provider endpoints to the web app runtime instead of isolating them in the Supabase function runtime with separate secrets and lifecycle.
- Vercel Cron triggers are configured for outbox, webhook, and calendar sync workers. The committed schedules are daily for Hobby deployment compatibility; production environments that need faster processing still need an upgraded Vercel plan or equivalent scheduler configuration.
- Host reservations cover one-on-one hold/booking collisions; group capacity inventory and round-robin/collective allocation are not implemented yet.
- Calendar OAuth, provider calendar list sync, busy-cache refresh, provider availability filtering, and provider event writes are implemented for Google and Microsoft. Provider watch/subscription renewal and provider webhook callbacks are not implemented yet.
- There is no realtime sync in the UI.

## Related Docs

- [Product Overview](product-overview.md)
- [Security](security.md)
- [Testing](testing.md)
- [System Design Gap Analysis](system-design-gaps.md)
