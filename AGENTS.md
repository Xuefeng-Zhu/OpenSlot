# AGENTS.md

Operational guide for coding agents and human contributors working in this repository. Update it whenever commands, architecture, or implementation status changes.

## Project Overview

OpenSlot is a private MVP scheduling app. Hosts authenticate with Butterbase, maintain a profile, define availability, receive bookings, and expose public booking pages. Guests view public event types, select an available slot, create a short-lived hold, and confirm a booking.

Current state: some dashboard surfaces are still prototype or mock-backed. The Butterbase-backed core is strongest around onboarding, profile, settings persistence, availability, event type CRUD, public profile/event pages, slot computation, holds, confirmed bookings, token cancellation/rescheduling, contact profiles/history, outbox processing, calendar provider sync, webhook endpoint management, and webhook delivery.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript strict mode, `@/*` → `./src/*`.
- Butterbase Auth, REST data APIs, Postgres/RLS, server-only service-key writes.
- Tailwind CSS v4 (`@tailwindcss/postcss`) and shadcn-style local UI primitives in `src/components/ui/`. Use `cn()` from `src/lib/utils.ts` for class merging.
- React Hook Form + Zod for forms.
- `date-fns` + `date-fns-tz` for time/timezone handling.
- Vitest (jsdom, globals) + Testing Library + `fast-check` + `jest-axe` for unit/component/property/a11y.
- Playwright (sequential, chromium-only) for E2E in `e2e/`.
- ESLint flat config (`eslint.config.mjs`). No Prettier: formatting is ESLint-only.
- Build: `next build --webpack` (Turbopack intentionally off).

## Repository Structure

```text
src/app/                         Next App Router routes and route handlers
src/app/(auth)/                  Login, signup, password reset pages
src/app/(dashboard)/             Authenticated dashboard route group
src/app/(public)/[username]/     Public profile and event booking pages
src/app/api/                     Route handlers (39 files, all `runtime = 'edge'`)
src/app/booking/                 Real routes (not in a group) for guest cancel/reschedule
src/proxy.ts                     Cookie refresh + dashboard guard helper (NOT wired as Next middleware)
src/components/booking/          Guest booking flow components
src/components/dashboard/        Dashboard views and reusable dashboard UI
src/components/shared/           Cross-feature UI helpers
src/components/ui/               Local shadcn-style primitives (Radix-backed)
src/lib/                         Core business logic (see src/lib/AGENTS.md)
e2e/                             Playwright E2E test specs and support
scripts/                         Calendar OAuth configuration helpers
backend/                         DB migrations, SQL invariants, Butterbase runtime (see backend/AGENTS.md)
docs/                            Contributor and architecture documentation
```

## Legacy / Stale (ignore)

- `supabase/`: only `.temp/` CLI cache remains. Project migrated to Butterbase; do not add Supabase SDK code.
- `outputs/`: manual run artifacts (demo videos, exports). Not gitignored; safe to ignore.
- `tsconfig.tsbuildinfo`: TypeScript incremental cache; not in source control.
- `src/test/`: single helper file (`fast-check.ts`) sitting outside `src/lib/`. Don't move it; the project uses this path.

## Commands

```bash
npm ci                            # Deterministic install from package-lock.json
npm run dev                       # next dev (port 3000)
npm run build                     # next build --webpack
npm run start                     # Production server (after build)
npm run lint                      # eslint .
npm run typecheck                 # tsc --noEmit --incremental false
npm run test                      # vitest --run
npm run test:watch                # vitest (watch mode)
npm run test:e2e                  # playwright test (auto-starts next dev)
npm run test:e2e:headed           # playwright test --headed
npm run test:e2e:ui               # playwright test --ui
npm run test:e2e:debug            # PWDEBUG=1 playwright test --debug
npm run verify                    # lint + typecheck + test + build
npm run oauth:calendar            # Both Google + Microsoft calendar OAuth
npm run oauth:google              # Google only
npm run oauth:microsoft           # Microsoft only
```

CI (`.github/workflows/ci.yml`) runs `npm ci` → `npm audit --audit-level=moderate` → `npm run lint` → `npm run typecheck` → `npm run test` → `npm run build` on push/PR to `main`. A separate `e2e` job runs `npm run test:e2e` against a configured Butterbase test app when secrets are present. Vercel cron schedules in `vercel.json` (daily, Hobby-tier compatible).

## Setup

```bash
npm ci
cp .env.example .env.local
# Fill in the values in .env.local (see Required env vars below)
npm run dev
```

Required env vars (full list in `.env.example`): `NEXT_PUBLIC_BUTTERBASE_APP_ID`, `NEXT_PUBLIC_BUTTERBASE_API_URL`, `BUTTERBASE_API_KEY`, and `NEXT_PUBLIC_APP_URL`. `SLOT_HOLD_TOKEN_SECRET` is the recommended optional signing secret; legacy deployments may still use `BUTTERBASE_FUNCTION_SECRET` as its fallback, but protected Butterbase functions authenticate with the provider-verified service key. Worker secret (`OUTBOX_PROCESS_SECRET`, `WEBHOOK_PROCESS_SECRET`, `CALENDAR_SYNC_SECRET`, `HOLD_EXPIRY_PROCESS_SECRET`, or shared `CRON_SECRET`). Calendar OAuth IDs + secrets. `CALENDAR_TOKEN_ENCRYPTION_SECRET`. Optional Turnstile keys. `EMAIL_PROVIDER` (`console` | `resend` | `maileroo`) + provider key.

Landing page renders without Butterbase credentials. Authenticated dashboard routes, public booking data, API routes, and booking writes require valid Butterbase configuration. Apply the schema, RLS policies, and functions from `backend/database/migrations/`, `backend/sql/provider-portability.sql`, and `backend/butterbase/` to the configured Butterbase app.

## Architecture

Server-first around booking integrity:

- Server Components fetch profile, event type, availability, and bookings data through backend clients backed by Butterbase.
- Client Components manage form and interaction state, then call route handlers for mutations.
- Public slot lookup: `GET /api/slots`. Guest hold creation: `POST /api/holds` + `create-slot-hold` backend function. Booking confirmation: `POST /api/bookings`.
- Booking confirmation/cancellation/rescheduling support optional idempotency via request body or `Idempotency-Key` header. Responses cached in `request_idempotency` for safe retries.
- Booking confirmation/cancellation/rescheduling enqueue outbox events for provider writes, emails, and tenant webhooks; update host-scoped contact aggregates as best-effort derived data.
- Contact anonymization: `DELETE /api/contacts/[id]` + `anonymize_contact_bookings()` RPC.
- Outbox processing: `GET/POST /api/outbox/process` (secret-protected). Calendar sync: `GET/POST /api/calendar/sync`. Webhook delivery: `GET/POST /api/webhooks/process`. Hold expiry: `GET/POST /api/holds/expire`. All gated by route secrets or `CRON_SECRET`.
- Host availability batch save: `POST /api/availability`.
- Booking cancellation logic: `src/lib/booking/cancel.ts` + `src/app/api/bookings/[id]/cancel/route.ts`.
- Booking rescheduling logic: `src/lib/booking/reschedule.ts` + `src/app/api/bookings/reschedule/route.ts`.

Database integrity is part of the architecture:

- `bookings.no_overlapping_bookings`: Postgres exclusion constraint preventing overlapping confirmed bookings per host. MUST NOT be removed.
- `host_reservations_no_overlap`: Postgres exclusion constraint preventing overlapping active holds/bookings per host. MUST NOT be removed.
- RLS enabled on all app tables. Data API grants are explicit; public pages use server-side service-key reads, not direct anon table access.
- Guest writes use the server backend client with token-based auth (`hold_token`, `cancellation_token`).

## State and Data Flow

- No global state library. Server Components fetch initial data; Client Components use local `useState`/`useMemo`/`useCallback`.
- Mutations go through API routes. Some dashboard prototype pages still use local state or mock data.
- Dashboard event type CRUD: `/api/event-types`.
- Availability editing: baseline in component state, diff computed, batch payload posted to `/api/availability`.
- Slot holds + host reservations + bookings in Butterbase. Holds expire after 5 min; lazily marked expired during hold creation or confirmation.
- Confirming a booking converts the hold reservation into a booking reservation; cancelling reverses it.
- Rescheduling: new hold + original `reschedule_token`; DB RPC updates old booking, inserts new booking, updates host reservations in one transaction.
- Confirmed/cancelled bookings append ID-based rows to `outbox_events` (notification emails sent by the processor) and `booking_events` (audit/replay).
- Confirmed/cancelled/rescheduled bookings maintain host-scoped `contacts` rows keyed by normalized email hash. Contact list and profile pages derive visible email/history from booking rows.
- Contact anonymization marks the contact deleted and scrubs matching booking guest fields, notes, cancellation reason through a server-side backend function.
- Tenant webhook outbox events create `webhook_deliveries`; delivery workers sign requests with endpoint secrets and retry non-2xx / network failures.

## Storage and Sync

- Persistent storage: Butterbase / Postgres.
- Auth sessions in HTTP-only OpenSlot cookies.
- No realtime sync, no client-side offline persistence.
- Calendar provider tokens and webhook secrets in server-only tables: no direct anon/authenticated grants.
- Calendar OAuth tokens encrypted at rest with `CALENDAR_TOKEN_ENCRYPTION_SECRET`.
- Email provider defaults to `console`; `EMAIL_PROVIDER=resend` or `maileroo` enables production sends.

## Coding Conventions

- TypeScript strict mode + `@/*` path alias.
- Server data fetching in Server Components or route handlers. `"use client"` only for interactive components.
- Use local UI primitives from `src/components/ui/` and `cn()` from `src/lib/utils.ts`.
- Zod schemas in `src/lib/validations/` for request and form validation.
- Pure/service-like modules for critical booking logic in `src/lib/booking/` and `src/lib/availability/`.
- `date-fns-tz` helpers for timezone-sensitive scheduling.
- JSDoc/TSDoc above exported functions in `src/lib/`, `src/app/api/`, and `src/proxy.ts`, especially when they cross module boundaries or perform side effects. Comment non-obvious business logic, retry/idempotency behavior, security boundaries, provider integrations, and stateful client workflows. Skip comments on obvious code or simple presentational components.
- Codebase mixes semicolon and no-semicolon styles by area: preserve the touched file's style.

## Security and Privacy

- Never expose `BUTTERBASE_API_KEY` to client code. Public env vars must be browser-safe.
- Guest booking and cancellation APIs rely on random tokens (`hold_token`, `cancellation_token`) as authorization.
- Public profile/event pages render via server-side service-key reads and return selected fields only.
- Public slot computation uses a service-key route after validating the requested event type is active and belongs to the host.
- Booking data includes guest names, emails, notes, timezones, cancellation tokens. Do not log or expose these casually.
- Outbox payloads stay narrow and ID-based unless a worker truly needs denormalized data.
- Email templates interpolate user-provided values into HTML: review escaping/sanitization before adding a real email provider.

## Testing

- Vitest config: `vitest.config.ts`. jsdom + globals, 15 s timeout, excludes `e2e/**`.
- Property tests use `fast-check` (100 runs default). Documented with `Property N: <description>` / `Validates: Requirements X.Y` JSDoc headers.
- A11y tests use `jest-axe`.
- Tests live in `__tests__` directories next to the code under test.
- Only shared test helper: `src/test/fast-check.ts` (`stringOf`, `char`, `validDate` arbitraries).
- Mocking patterns: `vi.hoisted` factories, `vi.importActual` for partial mocks, `vi.stubEnv` / `vi.unstubAllEnvs`, fake timers for slot/hold tests.
- Playwright config: chromium only, viewport 1280x900, `timezoneId: 'America/New_York'`, `workers: 1`, `retries: 2` in CI. `globalSetup` at `e2e/global-setup.ts`.
- E2E helpers in `e2e/support/` (auth, booking, db, env, test).

Targeted examples:

```bash
npm run test -- src/lib/availability/__tests__/compute-slots.test.ts
npm run test -- 'src/app/(dashboard)/__tests__/dashboard-booking-link.property.test.ts'
```

The full Vitest suite may print `Not implemented: navigation to another Document` from jsdom while still passing.

## Common Pitfalls for Coding Agents

- Quote paths containing route groups or dynamic segments in shell commands, e.g. `'src/app/(dashboard)/dashboard/page.tsx'`.
- Do not assume every visible dashboard surface is live: Settings still has prototype/mock portions.
- Dashboard event type list/new/edit pages are backed by Butterbase through server-loaded data and `/api/event-types` mutations.
- `src/app/booking/cancel/[token]/page.tsx` uses the cancellation token to load safe booking details server-side before rendering `src/components/booking/cancel-booking-form.tsx`.
- If lint cannot resolve Next/ESLint modules, run `npm ci`; stale `node_modules` mimic config bugs.
- Do not remove the booking exclusion constraint or weaken hold conflict checks without a replacement concurrency guard.
- Do not bypass `create_slot_hold_with_reservation()` for guest holds; direct `slot_holds` inserts miss the reservation exclusion constraint.
- Do not re-introduce a JS-side multi-step fallback for confirm or cancel. Booking confirmation and cancellation are atomic via `public.confirm_booking` and `public.cancel_booking` Postgres functions (migration `20260526120000_add_confirm_cancel_booking_functions.sql`); the JS lib in `src/lib/booking/confirm.ts` and `src/lib/booking/cancel.ts` MUST go through these RPCs. Tests in `src/lib/booking/__tests__/confirm.atomic.test.ts` and `src/lib/booking/__tests__/cancel.atomic.test.ts` enforce this contract; reintroducing a JS-side fallback (direct `outbox_events` / `booking_events` / `host_reservations` writes, calls to `enqueue*Outbox`, `appendBookingEvent`, `convertHoldReservationToBooking`, or `cancelBookingReservation` from the confirm/cancel libs) will fail the suite.
- Do not treat `outbox_events` as delivered work until the processor has successfully completed the row.
- Do not import `createAdminBackendClient` into a Client Component: server-only modules and route handlers only.
- `src/proxy.ts` is NOT wired as Next.js middleware. The dashboard `(dashboard)/layout.tsx` and per-page redirects handle auth. Do not add new auth checks assuming the proxy runs.
- All API routes use `export const runtime = 'edge'`. Do not remove it.
- Timezone changes need DST-aware tests.

## Safe-Change Guidelines

- For booking, availability, auth, and RLS changes, add or update tests.
- Keep service-key usage inside server-only modules and route handlers.
- Prefer extending existing schemas and helpers over duplicating validation.
- Avoid speculative rewrites of large dashboard components.
- Keep public behavior changes explicit in docs and tests.
- For backend schema changes, update `backend/database/migrations/`, provider-owned function artifacts, and `backend/sql/provider-portability.sql` together.
- Update `backend/butterbase/functions.json` AND `src/lib/backend/functions.ts` together (they are kept in sync manually).

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
- Butterbase RLS and service-key boundaries.
- Public profile/event pages and public API endpoints.
- Database migrations, especially constraints and policies.
- Email HTML templates before a real provider is added.

## Module References

Subdirectory AGENTS.md files add module-specific detail: read them when working in that area:

- [src/lib/AGENTS.md](src/lib/AGENTS.md): Core business logic (availability, booking, calendar, validations, backend adapters)
- [src/app/api/AGENTS.md](src/app/api/AGENTS.md): API route handlers (auth, slots, holds, bookings, availability, calendar, webhooks)
- [src/components/AGENTS.md](src/components/AGENTS.md): UI components (dashboard views, guest booking flow, shadcn primitives)
- [backend/AGENTS.md](backend/AGENTS.md): Database migrations, provider-portable SQL, Butterbase functions

## Supporting Docs

- [docs/product-overview.md](docs/product-overview.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/system-design-gaps.md](docs/system-design-gaps.md)
- [docs/development.md](docs/development.md)
- [docs/testing.md](docs/testing.md)
- [docs/security.md](docs/security.md)
- [docs/release.md](docs/release.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [docs/contributing.md](docs/contributing.md)
- [docs/agent-workflow.md](docs/agent-workflow.md)
