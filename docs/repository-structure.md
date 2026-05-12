# Repository Structure

This project uses the Next.js App Router with server-first data access. Keep
new files near the user flow or domain behavior they support, and prefer small
feature-local tests in `__tests__` directories.

## Top-Level Layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Route segments, layouts, pages, and route handlers. |
| `src/components/` | React components grouped by feature or shared UI primitive. |
| `src/lib/` | Server-safe domain logic, integrations, utilities, validations, and clients. |
| `supabase/migrations/` | Ordered database migrations, RLS policies, indexes, constraints, and RPCs. |
| `supabase/seed.sql` | Optional local/demo seed data. |
| `scripts/` | Local setup helpers, currently focused on calendar OAuth configuration. |
| `docs/` | Architecture, development, testing, release, and security documentation. |
| `.github/` | GitHub Actions, Dependabot, issue templates, and PR template. |

## App Routes

| Path | Purpose |
| --- | --- |
| `src/app/(auth)/` | Login, signup, password reset, and related public auth pages. |
| `src/app/(dashboard)/` | Authenticated host dashboard route group. |
| `src/app/(public)/[username]/` | Public host profile and event booking routes. |
| `src/app/api/` | Route handlers for slots, holds, bookings, availability, settings, workers, calendar, and webhooks. |
| `src/app/booking/` | Token-based guest cancellation and rescheduling pages. |
| `src/proxy.ts` | Supabase session refresh and dashboard redirect proxy. |

## Component Layout

| Path | Purpose |
| --- | --- |
| `src/components/booking/` | Guest-facing booking, cancellation, and rescheduling components. |
| `src/components/dashboard/` | Host dashboard views and dashboard-specific UI. |
| `src/components/shared/` | Cross-feature UI helpers. |
| `src/components/ui/` | Local shadcn-style primitives. Prefer these before adding new primitives. |

## Library Layout

| Path | Purpose |
| --- | --- |
| `src/lib/availability/` | Slot computation and availability types. |
| `src/lib/booking/` | Confirm, cancel, reschedule, and booking audit behavior. |
| `src/lib/calendar/` | Calendar OAuth, provider sync, busy cache, and provider event writes. |
| `src/lib/email/` | Email rendering and provider selection. |
| `src/lib/idempotency/` | Request idempotency hashing, conflict detection, and cached responses. |
| `src/lib/outbox/` | Side-effect event enqueueing and processing. |
| `src/lib/reservations/` | Host reservation ledger mirrors for holds and bookings. |
| `src/lib/supabase/` | Browser, server, and service-role Supabase clients. |
| `src/lib/validations/` | Zod schemas for forms and API boundaries. |
| `src/lib/webhooks/` | Webhook endpoint summaries, delivery queueing, signatures, and retries. |
| `src/lib/workers/` | Shared worker route authentication. |

## Naming and Placement Guidelines

- Put route-specific client components beside their route group when they are
  not reused elsewhere.
- Put reusable feature components in `src/components/<feature>/`.
- Put critical booking and availability behavior in `src/lib/booking/` or
  `src/lib/availability/` so it can be tested without rendering UI.
- Keep service-role access inside route handlers or server-only libraries.
- Add database changes as new migrations rather than editing applied
  migrations.
- Add tests near the behavior under test, usually in a sibling `__tests__`
  directory.
