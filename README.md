# OpenSlot

OpenSlot is a private MVP scheduling app for hosts who want to publish
availability, share event-specific booking pages, and keep bookings in sync
with calendar and notification side effects.

The strongest production-shaped paths today are onboarding, profile/settings
persistence, availability, event type management, public booking pages, slot
computation, holds, confirmed bookings, cancellation/rescheduling tokens,
outbox processing, calendar provider sync, and tenant webhook delivery
processing. Some dashboard surfaces are still prototype or mock-backed; check
[docs/product-overview.md](docs/product-overview.md) before extending a flow.

## Screenshots

Screenshots are not committed yet. Suggested first additions:

- Public profile and event booking page.
- Host dashboard overview.
- Availability editor.
- Event type editor.

## Features

- Supabase email/password authentication.
- Host onboarding with profile, availability, and first event type setup.
- Supabase-backed event type create, edit, pause, delete, and share flows.
- Weekly availability and date overrides with timezone-aware slot generation.
- Public booking pages at `/{username}` and `/{username}/{eventSlug}`.
- Five-minute slot holds backed by a host reservation ledger.
- Confirmed booking, cancellation, and rescheduling flows with idempotency keys.
- PostgreSQL exclusion constraints to prevent overlapping active reservations.
- Outbox events for email, calendar, and tenant webhook side effects.
- Console email provider by default, with Resend and Maileroo provider support.
- Google and Microsoft calendar OAuth foundation and busy-cache sync.

## Tech Stack

| Area | Stack |
| --- | --- |
| App framework | Next.js 16 App Router, React 18 |
| Language | TypeScript strict mode |
| Database and auth | Supabase Auth, Postgres, RLS, service-role route handlers |
| Styling | Tailwind CSS and local shadcn-style primitives |
| Forms and validation | React Hook Form and Zod |
| Dates and timezones | `date-fns` and `date-fns-tz` |
| Tests | Vitest, jsdom, Testing Library, `fast-check`, `jest-axe`, Playwright |
| Deployment shape | Next build with Vercel cron config in `vercel.json` |

## Architecture Overview

OpenSlot is server-first around booking integrity:

- Server Components fetch profiles, event types, availability, bookings, and
  public booking data through Supabase server clients.
- Client Components manage form state and call API routes for mutations.
- Public slot lookup uses `/api/slots`.
- Guest holds use `/api/holds` and the `create_slot_hold_with_reservation()`
  database RPC.
- Booking confirmation, cancellation, and rescheduling enqueue outbox events
  for provider writes, emails, and tenant webhooks.
- Worker routes under `/api/outbox/process`, `/api/calendar/sync`, and
  `/api/webhooks/process` are protected by route secrets or `CRON_SECRET`.
- Supabase RLS and explicit grants keep browser access narrow. Service-role
  reads/writes stay in server-only modules and route handlers.

See [docs/architecture.md](docs/architecture.md) for the deeper system map.

## Repository Structure

```text
src/app/                         Next.js App Router routes and API handlers
src/app/(auth)/                  Login and signup routes
src/app/(dashboard)/             Authenticated host dashboard routes
src/app/(public)/[username]/     Public host profile and event booking pages
src/components/booking/          Guest booking flow components
src/components/dashboard/        Dashboard views and dashboard UI
src/components/ui/               Local shadcn-style primitives
src/lib/availability/            Slot computation engine
src/lib/booking/                 Booking confirmation, cancellation, reschedule logic
src/lib/calendar/                Calendar OAuth, sync, and provider event helpers
src/lib/email/                   Email composition and provider selection
src/lib/idempotency/             Retry-safe mutation helpers
src/lib/outbox/                  Internal side-effect queue processing
src/lib/reservations/            Host reservation mirror helpers
src/lib/supabase/                Browser, server, and admin Supabase clients
src/lib/validations/             Zod schemas
supabase/migrations/             Database schema, indexes, RLS, and RPC migrations
supabase/seed.sql                Local/demo seed data
docs/                            Architecture, development, testing, release docs
```

See [docs/repository-structure.md](docs/repository-structure.md) for ownership
notes and naming conventions.

## Prerequisites

- Node.js 22 LTS or newer recommended. The current toolchain requires Node.js
  20.19 or newer.
- npm. Use `npm ci` for deterministic installs from `package-lock.json`.
- A Supabase project or the Supabase CLI for local database development.

## Local Setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the required Supabase and app values in `.env.local`.

4. For local Supabase development, start the local stack and reset the local
   database from the committed migrations:

   ```bash
   supabase start
   supabase db reset --local
   ```

   `supabase db reset --local` applies `supabase/migrations/` and then loads
   `supabase/seed.sql` through the `[db.seed]` config. For linked staging or
   production projects, review the pending remote migrations first:

   ```bash
   supabase db push --linked --dry-run
   supabase db push --linked
   ```

   Add `--include-seed` only when you intentionally want to apply configured
   seed data to the linked project.

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

The landing page can render without Supabase credentials. Authenticated
dashboard routes, public booking data, API routes, and booking writes require
valid Supabase configuration.

## Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser-visible Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-visible Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key for privileged route handlers. Never expose to client code. |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app origin for links and OAuth callbacks. Use `http://localhost:3000` locally. |
| `OUTBOX_PROCESS_SECRET` | Production | Protects manual `/api/outbox/process` calls. |
| `WEBHOOK_PROCESS_SECRET` | Production | Protects manual `/api/webhooks/process` calls. |
| `CALENDAR_SYNC_SECRET` | Production | Protects manual `/api/calendar/sync` calls. |
| `CRON_SECRET` | Production | Shared Vercel Cron bearer token. |
| `GOOGLE_CALENDAR_CLIENT_ID` | Calendar integration | Google OAuth client ID. |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Calendar integration | Google OAuth client secret. |
| `MICROSOFT_CALENDAR_CLIENT_ID` | Calendar integration | Microsoft OAuth app client ID. |
| `MICROSOFT_CALENDAR_CLIENT_SECRET` | Calendar integration | Microsoft OAuth client secret. |
| `MICROSOFT_CALENDAR_TENANT` | Calendar integration | Defaults to `common`. |
| `CALENDAR_TOKEN_ENCRYPTION_SECRET` | Calendar integration | Stable high-entropy server-only encryption secret. |
| `EMAIL_PROVIDER` | Optional | `console`, `resend`, or `maileroo`. Defaults to console behavior. |
| `EMAIL_FROM` | Email provider | Required for real provider sends. |
| `RESEND_API_KEY` | Resend | Required when `EMAIL_PROVIDER=resend`. |
| `MAILEROO_API_KEY` | Maileroo | Required when `EMAIL_PROVIDER=maileroo`. |

Use `.env.example` as the source of truth for local keys.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build with `next build --webpack`. |
| `npm run start` | Start the production server after a build. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run test` | Run the Vitest suite once. |
| `npm run test:e2e` | Run the Playwright core E2E suite. |
| `npm run test:e2e:headed` | Run Playwright with a visible browser. |
| `npm run test:e2e:ui` | Open the Playwright UI runner. |
| `npm run test:e2e:debug` | Run Playwright in debug mode. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run verify` | Run lint, typecheck, tests, and build. |
| `npm run oauth:calendar` | Configure calendar OAuth credentials interactively. |
| `npm run oauth:google` | Configure Google Calendar OAuth credentials. |
| `npm run oauth:microsoft` | Create/configure a Microsoft Calendar OAuth app registration. |

OAuth helper scripts write to `.env.local` by default. Use `--env-file <path>`
or shell `ENV_FILE=<path>` to target another file. The scripts derive callback
URLs from `NEXT_PUBLIC_APP_URL`; shell overrides are available as
`GOOGLE_CALENDAR_REDIRECT_URI`, `GOOGLE_CALENDAR_JS_ORIGIN`,
`GOOGLE_CLOUD_PROJECT` or `GCLOUD_PROJECT`, and
`MICROSOFT_CALENDAR_REDIRECT_URI`.

## Testing

Run the normal local gate before opening a PR:

```bash
npm run lint
npm run typecheck
npm run test
```

Run `npm run build` for route, environment, Next.js, or production-sensitive
changes. Run `npm run test:e2e` when validating page rendering, authenticated
dashboard behavior, guest booking, or navigation against local Supabase seed
data. The full Vitest suite may print `Not implemented: navigation to another
Document` from jsdom while still passing.

See [docs/testing.md](docs/testing.md) for targeted test examples and coverage
guidance.

## Deployment

GitHub Actions runs the app release gate, Dashboard E2E, npm dependency audit,
and local Supabase migration validation for pushes and pull requests targeting
`main`.
Production deploys still need the environment variables above and database
migrations applied out of band. `vercel.json` defines cron schedules for
outbox, webhook, and calendar sync worker routes. The committed schedules are
daily for Vercel Hobby compatibility; production environments that need faster
worker processing should use a plan or scheduler that supports the desired
cadence. Non-Vercel deployments should configure equivalent scheduled requests
with bearer-token authentication.

See [docs/release.md](docs/release.md) for release and deployment notes.

## Contributing

This repository is private. Keep changes focused, tested, and explicit about
whether a touched surface is live, prototype, or mock-backed.

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting.
- Use the PR template in `.github/pull_request_template.md`.
- Update docs when behavior, setup, architecture, commands, or environment
  variables change.

## Security

OpenSlot handles guest names, emails, notes, timezones, booking times, and
cancellation/rescheduling tokens. Treat that data as sensitive.

- Never commit `.env.local` or real credentials.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or provider secrets to client code.
- Review [SECURITY.md](SECURITY.md) before changing public APIs, RLS,
  service-role code, booking integrity logic, or provider integrations.

## Additional Documentation

- [Product overview](docs/product-overview.md)
- [Architecture](docs/architecture.md)
- [Repository structure](docs/repository-structure.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Release and deployment](docs/release.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Agent workflow](docs/agent-workflow.md)
- [Agent instructions](AGENTS.md)

## License

Private and proprietary. See [LICENSE](LICENSE).
