# AGENTS.md

Operational guide for coding agents and human contributors working in this repository. Keep this file practical and update it whenever commands, architecture, or implementation status changes.

## Project Overview

OpenSlot is an MVP scheduling app. Hosts can authenticate with Supabase, maintain a profile, define availability, receive bookings, and expose public booking pages. Guests can view public event types, select an available slot, create a short-lived hold, and confirm a booking.

Important current-state note: some dashboard surfaces are still prototype or mock-backed. The Supabase-backed core is strongest around onboarding setup, profile, settings persistence, availability, dashboard event type list/new/edit, public profile/event pages, slot computation, holds, confirmed bookings, token cancellation/rescheduling flows, outbox processing, calendar provider sync, webhook endpoint dashboard management, and webhook delivery processing.

## Tech Stack

- Next.js 16 App Router with React 18 and TypeScript strict mode.
- Supabase Auth, Postgres, RLS, and service-role API writes.
- Tailwind CSS and shadcn-style local UI primitives in `src/components/ui/`.
- React Hook Form and Zod for forms that are wired to validation schemas.
- `date-fns` and `date-fns-tz` for time and timezone handling.
- Vitest, jsdom, Testing Library, `fast-check`, and `jest-axe` for tests.

## Repository Structure

```text
src/app/                         Next App Router routes
src/app/(auth)/                  Login and signup pages
src/app/(dashboard)/             Authenticated dashboard route group
src/app/(public)/[username]/     Public profile and event booking pages
src/app/api/                     Route handlers for slots, holds, bookings, availability
src/components/booking/          Guest booking flow components
src/components/dashboard/        Dashboard views and reusable dashboard UI
src/components/shared/           Cross-feature UI helpers
src/components/ui/               Local shadcn-style primitives
src/lib/availability/            Slot computation engine and types
src/lib/booking/                 Booking confirmation/cancellation engines
src/lib/email/                   Email templates and console provider
src/lib/idempotency/             Request idempotency helpers for retry-safe mutations
src/lib/outbox/                  Internal side-effect event enqueue helpers
src/lib/reservations/            Host reservation mirror helpers
src/lib/supabase/                Browser, server, and admin Supabase clients
src/lib/validations/             Zod schemas
src/lib/utils/                   Slug and timezone helpers
src/proxy.ts                     Supabase session refresh and dashboard redirect proxy
supabase/migrations/             Database schema, indexes, RLS, trigger
supabase/seed.sql                Local demo data
docs/                            Contributor and architecture documentation
```

## Important Commands

Use `npm ci` for deterministic installs from `package-lock.json`.

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:watch
npm run build
npm run start
```

Supabase CLI commands used by the project:

```bash
supabase start
supabase db push
supabase db reset
supabase db seed
```

There is no committed CI workflow. Vercel worker cron config exists in `vercel.json`. Treat `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` as the release gate.

## Setup Instructions

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create `.env.local` from `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   OUTBOX_PROCESS_SECRET=...
   WEBHOOK_PROCESS_SECRET=...
   CRON_SECRET=...
   GOOGLE_CALENDAR_CLIENT_ID=...
   GOOGLE_CALENDAR_CLIENT_SECRET=...
   MICROSOFT_CALENDAR_CLIENT_ID=...
   MICROSOFT_CALENDAR_CLIENT_SECRET=...
   CALENDAR_TOKEN_ENCRYPTION_SECRET=...
   CALENDAR_SYNC_SECRET=...
   EMAIL_PROVIDER=console
   EMAIL_FROM="OpenSlot <bookings@example.com>"
   RESEND_API_KEY=...
   MAILEROO_API_KEY=...
   ```

4. Apply database migrations using Supabase CLI or the SQL editor:

   ```bash
   supabase db push
   ```

5. Optional local seed:

   ```bash
   supabase db seed
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

The landing page can render without Supabase credentials. Authenticated dashboard routes, public booking data, API routes, and booking writes require valid Supabase configuration.

## Development Workflow

1. Inspect the target flow and adjacent tests before editing.
2. Prefer small, reviewable changes with narrow file ownership.
3. Update tests when behavior changes.
4. Update docs when commands, setup, architecture, environment variables, or user-visible behavior changes.
5. Run the smallest relevant validation first, then the broader gate before handing off.

Recommended validation for normal changes:

```bash
npm run lint
npm run typecheck
npm run test
```

Run `npm run build` for route, env, Next.js, or production-sensitive changes.

## Testing and Validation

- Vitest config is in `vitest.config.ts`.
- Tests run in `jsdom` with globals enabled and `@/*` mapped to `src/*`.
- Property-based coverage uses `fast-check`.
- Accessibility-focused tests use `jest-axe`.
- Tests live near code in `__tests__` directories.

Useful targeted examples:

```bash
npm run test -- src/lib/availability/__tests__/compute-slots.test.ts
npm run test -- 'src/app/(dashboard)/__tests__/dashboard-booking-link.property.test.ts'
```

The full test suite may print `Not implemented: navigation to another Document` from jsdom while still passing.

## Coding Conventions

- Use TypeScript strict mode and the `@/*` path alias.
- Keep server data fetching in Server Components or route handlers when possible.
- Use `"use client"` only for interactive components.
- Use local UI primitives from `src/components/ui/` and `cn()` from `src/lib/utils.ts`.
- Prefer Zod schemas in `src/lib/validations/` for request and form validation.
- Keep critical booking logic in pure or service-like modules under `src/lib/booking/` and `src/lib/availability/`.
- Use `date-fns-tz` helpers for timezone-sensitive scheduling logic.
- Document important behavior with concise comments:
  - Use JSDoc/TSDoc above exported TypeScript functions in `src/lib/`, `src/app/api/`, and `src/proxy.ts`, especially when they cross module boundaries or perform side effects.
  - Add comments for complex business logic, non-obvious data transforms, retry/idempotency behavior, security boundaries, provider integrations, and stateful client workflows.
  - Avoid comments that restate obvious code or annotate simple presentational components.
- Preserve existing style in touched files. The codebase currently mixes semicolon and no-semicolon styles by area.

## Architecture Overview

OpenSlot is server-first for data access and booking integrity:

- Server Components fetch profile, event type, availability, and bookings data through `createServerSupabaseClient()`.
- Client Components manage form and interaction state, then call route handlers for mutations.
- Public slot lookup uses `/api/slots`.
- Guest hold creation uses `/api/holds` and the `create_slot_hold_with_reservation()` RPC.
- Booking confirmation uses `/api/bookings`.
- Booking confirmation, cancellation, and rescheduling support optional idempotency keys through request bodies or the `Idempotency-Key` header.
- Booking confirmation, cancellation, and rescheduling enqueue outbox events for provider writes, notifications, and tenant webhooks.
- Outbox events are processed through `GET/POST /api/outbox/process` using `OUTBOX_PROCESS_SECRET` or `CRON_SECRET`.
- Calendar provider metadata and busy cache are refreshed through `GET/POST /api/calendar/sync` using `CALENDAR_SYNC_SECRET` or `CRON_SECRET`.
- Tenant webhook deliveries are processed through `GET/POST /api/webhooks/process` using `WEBHOOK_PROCESS_SECRET` or `CRON_SECRET`.
- Host availability batch save uses `/api/availability`.
- Booking cancellation logic is in `src/lib/booking/cancel.ts` and the API route `src/app/api/bookings/[id]/cancel/route.ts`.
- Booking rescheduling logic is in `src/lib/booking/reschedule.ts` and the API route `src/app/api/bookings/reschedule/route.ts`.

Database integrity is part of the architecture:

- `bookings.no_overlapping_bookings` is a PostgreSQL exclusion constraint that prevents overlapping confirmed bookings per host.
- `host_reservations_no_overlap` is a PostgreSQL exclusion constraint that prevents overlapping active holds/bookings per host.
- RLS is enabled on all app tables.
- Data API grants are explicit; public pages and slot reads use server-side service-role code instead of direct anon table access.
- API routes that need guest writes use the service role client and token-based authorization.

See [docs/architecture.md](docs/architecture.md) for more detail.

## Key Modules and Responsibilities

- `src/lib/availability/compute-slots.ts`: core slot generation and filtering, including rules, overrides, bookings, holds, buffers, min notice, and max booking window.
- `src/app/api/slots/route.ts`: public slot computation endpoint.
- `src/app/api/holds/route.ts`: creates 5-minute slot holds and checks active holds/bookings.
- `src/lib/booking/confirm.ts`: validates holds, inserts confirmed bookings, marks holds confirmed, and queues side effects.
- `src/lib/booking/cancel.ts`: marks confirmed bookings cancelled and queues side effects.
- `src/lib/booking/reschedule.ts`: swaps a confirmed booking to a new hold through `reschedule_booking_with_hold()`, then queues side effects.
- `src/lib/booking/events.ts`: appends ID-based booking lifecycle audit events.
- `src/lib/idempotency/request-idempotency.ts`: hashes validated request payloads, detects key reuse conflicts, and replays cached API responses.
- `src/lib/outbox/outbox.ts`: enqueues deterministic, deduped booking side-effect events.
- `src/lib/outbox/process.ts`: claims outbox rows, runs event handlers, and marks completion/failure.
- `src/lib/calendar/connections.ts`: returns safe calendar connection summaries without exposing stored token columns.
- `src/lib/calendar/oauth.ts`: builds Google/Microsoft OAuth URLs, exchanges codes, refreshes tokens, and loads provider identities.
- `src/lib/calendar/provider-sync.ts`: refreshes provider access tokens, syncs calendar metadata, rebuilds busy-cache rows, and adapts provider event APIs.
- `src/lib/calendar/events.ts`: handles calendar outbox rows by creating/cancelling provider events and storing external references.
- `src/lib/webhooks/endpoints.ts`: returns safe webhook endpoint summaries without exposing signing secrets.
- `src/lib/webhooks/deliveries.ts`: queues tenant webhook deliveries, signs payloads, posts to endpoints, and tracks retries.
- `src/lib/reservations/host-reservations.ts`: mirrors hold/booking lifecycle changes into `host_reservations`.
- `src/lib/email/send.ts`: email composition and provider selection; console provider by default, Resend or Maileroo when configured.
- `src/lib/supabase/admin.ts`: service role client. Never use this from client components.
- `src/proxy.ts`: refreshes sessions and redirects unauthenticated `/dashboard` requests. The `(dashboard)` layout also enforces auth for the dashboard route group.

## State Management and Data Flow

- There is no global state library.
- Server Components fetch initial data.
- Client Components use local `useState`, `useMemo`, and `useCallback`.
- Mutations typically go through API routes, except some dashboard prototype pages that use local state or mock data.
- Dashboard event type creation, updates, and deletion go through `/api/event-types`.
- Availability editing keeps a saved baseline in component state, computes diffs, and posts a batch payload to `/api/availability`.
- Slot holds, host reservations, and bookings are stored in Supabase; holds expire after 5 minutes and are lazily marked expired during hold creation or confirmation.
- Confirming a booking converts the hold reservation into a booking reservation; cancelling a booking cancels the booking reservation.
- Rescheduling uses a new hold plus the original `reschedule_token`; the database RPC updates the old booking, inserts the new booking, and updates host reservations in one transaction.
- Booking confirmation, cancellation, and rescheduling forms send idempotency keys; the API caches responses in `request_idempotency` for safe retries.
- Confirmed and cancelled bookings append ID-based rows to `outbox_events`; notification emails are sent by the outbox processor.
- Confirmed, cancelled, and rescheduled bookings append ID-based rows to `booking_events` for audit/replay.
- Tenant webhook outbox events create `webhook_deliveries`; delivery workers sign requests with endpoint secrets and retry non-2xx or network failures.

## Storage and Sync Behavior

- Persistent storage is Supabase Postgres.
- Supabase Auth sessions are stored in cookies through `@supabase/ssr`.
- There is no realtime sync in the current UI.
- There is no client-side offline persistence.
- Calendar provider tokens and webhook secrets are stored only in server-only tables without direct anon/authenticated grants.
- Calendar OAuth tokens are encrypted before storage with `CALENDAR_TOKEN_ENCRYPTION_SECRET`.
- Emails are logged to the console by default; `EMAIL_PROVIDER=resend` enables production sends through Resend, and `EMAIL_PROVIDER=maileroo` enables sends through Maileroo.

## Security and Privacy Considerations

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.
- Public environment variables must be limited to values safe for browsers.
- Guest booking and cancellation APIs rely on random tokens (`hold_token`, `cancellation_token`) as authorization.
- Public profile/event pages render through server-side service-role reads and return selected fields only.
- Public slot computation uses a service-role route after validating the requested event type is active and belongs to the host.
- Booking data includes guest names, emails, notes, timezones, and cancellation tokens. Do not log or expose these casually.
- Keep outbox payloads narrow and ID-based unless a worker truly needs denormalized data.
- Email templates interpolate user-provided values into HTML. Review escaping/sanitization before adding a real email provider.

See [docs/security.md](docs/security.md).

## Common Pitfalls for Coding Agents

- Quote paths containing route groups or dynamic segments in shell commands, for example `'src/app/(dashboard)/dashboard/page.tsx'`.
- Do not assume every visible dashboard surface is live. Settings still has prototype/mock portions.
- Dashboard event type list/new/edit pages are backed by Supabase through server-loaded data and `/api/event-types` mutations.
- `src/app/booking/cancel/[token]/page.tsx` uses the cancellation token to load safe booking details server-side before rendering `src/components/booking/cancel-booking-form.tsx`.
- If lint cannot resolve Next/ESLint modules, run `npm ci`; stale `node_modules` can mimic config bugs.
- Do not remove the booking exclusion constraint or weaken hold conflict checks without a replacement concurrency guard.
- Do not bypass `create_slot_hold_with_reservation()` for guest holds; direct `slot_holds` inserts miss the reservation exclusion constraint.
- Do not treat `outbox_events` as delivered work until the processor has successfully completed the row.
- Timezone changes need DST-aware tests.

## Safe-Change Guidelines

- For booking, availability, auth, and RLS changes, add or update tests.
- Keep service role usage inside server-only modules and route handlers.
- Prefer extending existing schemas and helpers over duplicating validation.
- Avoid speculative rewrites of large dashboard components.
- Keep public behavior changes explicit in docs and tests.
- For database changes, add a new migration rather than editing applied migrations unless the project explicitly decides to squash/reset.

## Release and Build Notes

- Production build command: `npm run build`.
- Production start command after build: `npm run start`.
- No deployment target is committed. Any deploy must provide the required env vars and run migrations out of band.
- The build uses `next build --webpack`.
- `NEXT_PUBLIC_APP_URL` is used for cancellation links in booking confirmation emails.

See [docs/release.md](docs/release.md).

## PR Checklist

- Scope is small and clear.
- User flow or bug fix is described.
- Relevant tests were added or updated.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test` passes.
- `npm run build` passes for route/env/production-sensitive work.
- Docs were updated when behavior, setup, architecture, or commands changed.
- No secrets or private credentials were committed.
- Mock/prototype areas were not described as production-ready.

## Areas That Need Extra Caution

- Slot computation and timezone logic.
- Booking confirmation, cancellation, and rescheduling engines.
- Hold expiration and conflict handling.
- Supabase RLS and service role boundaries.
- Public profile/event pages and public API endpoints.
- Database migrations, especially constraints and policies.
- Email HTML templates before a real provider is added.

## Supporting Docs

- [docs/product-overview.md](docs/product-overview.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/development.md](docs/development.md)
- [docs/testing.md](docs/testing.md)
- [docs/security.md](docs/security.md)
- [docs/release.md](docs/release.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [docs/contributing.md](docs/contributing.md)
- [docs/agent-workflow.md](docs/agent-workflow.md)
