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
| `src/app/(dashboard)/profile/page.tsx` | Profile settings. |
| `src/app/(dashboard)/onboarding/page.tsx` | Client onboarding flow that saves profile, availability, and first event type through `/api/onboarding`. |
| `src/app/(dashboard)/event-types/*` | Event type list/new/edit dashboard UI backed by Supabase and `/api/event-types`. |
| `src/app/(public)/[username]/page.tsx` | Public host profile and active event types. |
| `src/app/(public)/[username]/[eventSlug]/page.tsx` | Public booking flow shell. |
| `src/app/booking/cancel/[token]/page.tsx` | Public token-backed booking cancellation page. |
| `src/app/api/*` | Slot, hold, booking, cancellation, event type, and availability APIs. |

## Data Access Patterns

- `src/lib/supabase/server.ts` creates a cookie-aware Supabase client for Server Components and route handlers.
- `src/lib/supabase/client.ts` creates the browser client for client components.
- `src/lib/supabase/admin.ts` creates a service role client for server-only writes that must bypass RLS.
- `src/proxy.ts` refreshes Supabase sessions. The dashboard route group also enforces auth in `src/app/(dashboard)/layout.tsx`.

## Booking Flow

```text
Public event page
  -> SlotPicker
  -> GET /api/slots
  -> computeAvailableSlots()
  -> POST /api/holds
  -> BookingForm
  -> POST /api/bookings
  -> request_idempotency check/cache when an idempotency key is supplied
  -> confirmBooking()
  -> bookings insert + hold status update
  -> outbox_events enqueue for provider writes, notifications, and future webhooks
  -> email notifications through the current console provider
  -> /booking/cancel/[token]
  -> POST /api/bookings/[id]/cancel
  -> request_idempotency check/cache when an idempotency key is supplied
  -> cancelBooking()
  -> outbox_events enqueue for provider updates, notifications, and future webhooks
```

The final anti-double-booking guard is the Postgres exclusion constraint in `supabase/migrations/007_create_bookings.sql`.

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

## API Routes

| Route | Auth | Main module |
| --- | --- | --- |
| `GET /api/slots` | Public read | `src/lib/availability/compute-slots.ts` |
| `POST /api/holds` | Public token/slot operation, service role write | `src/app/api/holds/route.ts` |
| `POST /api/bookings` | Hold token operation, optional idempotency key, service role write | `src/lib/booking/confirm.ts` |
| `POST /api/bookings/[id]/cancel` | Cancellation token operation, optional idempotency key, service role write | `src/lib/booking/cancel.ts` |
| `POST /api/onboarding` | Authenticated host setup | `src/app/api/onboarding/route.ts` |
| `POST /api/event-types` | Authenticated host | `src/app/api/event-types/route.ts` |
| `PATCH/DELETE /api/event-types/[id]` | Authenticated host, scoped to own profile | `src/app/api/event-types/[id]/route.ts` |
| `POST /api/availability` | Authenticated host | `src/app/api/availability/route.ts` |

## Current Gaps to Preserve in Docs

- Settings still includes prototype surfaces; event type dashboard pages and the public cancellation page are live-backed.
- Settings do not persist.
- Outbox rows are written for confirmed/cancelled bookings, but there is no queue worker or webhook delivery processor yet.
- No realtime sync or calendar integrations are implemented.

## Related Docs

- [Product Overview](product-overview.md)
- [Security](security.md)
- [Testing](testing.md)
