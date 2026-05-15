# E2E Testing

OpenSlot has a committed Playwright E2E lane for the core public, guest, and
authenticated host journeys. The suite runs against local Supabase seed data,
creates isolated rows for mutating flows, and cleans those rows with the local
service-role key.

## Automated Dashboard E2E

The automated suite uses local Supabase seed data, including this host account:

- Email: `demo@openslot.dev`
- Password: `demo-password-123`

Run it locally with:

```bash
supabase start
supabase db reset --local
npm run test:e2e
```

Useful development modes:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
```

The Playwright config starts the Next.js dev server at
`PLAYWRIGHT_BASE_URL`, defaulting to `http://127.0.0.1:3000`. Use another port,
for example `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100`, when port 3000 is
already occupied. It expects Supabase env vars to be available in the shell or
`.env.local`. Before tests run, Playwright refreshes and verifies the demo host
password through the configured service-role key so browser login uses a real
Supabase Auth password flow. If the demo host is missing, setup creates the auth
user, profile, and weekday availability needed by isolated E2E specs.

The CI `Dashboard E2E` job installs Chromium, starts local Supabase, resets and
seeds the database, exports the local Supabase env vars, runs
`npm run test:e2e`, and stops Supabase in an `always()` cleanup step.

## Automated Coverage

| Priority | Area | Automated coverage |
| --- | --- | --- |
| P0 | App/public smoke | Landing, legal, auth, public profile/event, cancellation token, reschedule token, authenticated dashboard pages, and no browser console/page errors. |
| P0 | Auth/access control | Signed-out redirects, login field validation, invalid credentials, valid demo login, return URL handling, and session persistence after reload. |
| P0 | Event types | Validation, create, reload persistence, public URL visibility, edit, pause, public hiding, delete, search, and status filters. |
| P0 | Guest booking | Public slot lookup, date/time selection, booking form validation, booking confirmation, cancel/reschedule links, host booking visibility, and stale-slot conflict handling without duplicate bookings. |
| P1 | Bookings | Event-type filtering, details drawer, host cancellation dialog, cancelled tab, and database status/reason verification. |
| P1 | Contacts | Search no-match/match states and contact profile meeting history for an isolated booking. |
| P1 | Availability | Invalid interval validation, discard behavior, date override save, reload persistence, and service-role restoration. |
| P1 | Profile/settings | Profile save with public profile persistence, display preference persistence, and service-role restoration. |
| P1 | Webhooks | Invalid URL handling, create, one-time signing secret, pause, enable, delete, and cleanup. |
| P1 | Mobile nav | Narrow viewport dashboard drawer navigation to primary pages. |
| P2 | Onboarding/token edges | Non-mutating onboarding validation/back flow and safe invalid guest action links. |

Mutating specs create unique event types, bookings, contacts, availability
overrides, or webhook endpoints. Cleanup runs in `finally` blocks; the CI job
also starts from a freshly reset local database.

## Manual Prerequisites

1. Install dependencies and configure `.env.local`.
2. Apply all database migrations:

   ```bash
   supabase db push --include-all --yes
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Use a test host account with:
   - A completed profile.
   - At least one active event type.
   - Availability that exposes future slots.
   - Supabase service-role env vars configured for booking writes.

Do not commit real account credentials or customer data in test notes.

## Supplemental Manual Suite

The automated suite covers the high-priority core journeys. Use this manual
suite for release smoke testing, live-provider validation, and flows that are
too slow or external for CI.

| Area | Scenario | Expected result |
| --- | --- | --- |
| Public pages | Load `/`, `/signup`, `/terms`, `/privacy`, `/login` | Pages render meaningful content with no framework overlay or console errors. |
| Auth | Submit invalid login credentials, then valid test credentials | Invalid login shows an error; valid login reaches `/dashboard`. |
| Dashboard smoke | Visit `/dashboard`, `/event-types`, `/availability`, `/bookings`, `/profile`, `/settings` | Each authenticated route renders its primary heading and has no console errors. |
| Event types | Create, edit, pause, and delete a temporary event type | The event appears, persists, hides publicly when paused, and is removed after delete. |
| Public booking | Open the public profile and temporary event page, then pick a date and slot | Available times load; selecting a slot creates a hold and opens the booking form. |
| Booking form | Submit empty required fields, then valid guest details | Validation appears first; the confirmation screen appears after valid submit. |
| Host bookings | Open `/bookings` after confirmation | The booking appears under Upcoming with confirmed status. |
| Reschedule | Use the guest reschedule link and choose a new slot | The reschedule confirmation appears and the host dashboard shows the new date/time. |
| Cancellation | Use the guest cancellation link | The cancellation confirmation appears; Upcoming is cleared and Cancelled shows the booking. |
| Webhooks | In Settings > Integrations, create and delete a temporary webhook endpoint | A one-time signing secret appears after create; delete removes the endpoint and the secret banner. |
| Mobile smoke | Set a narrow viewport and open a public event page | Date picker and available-time list remain usable with no console errors. |

## Validation Commands

Run the focused checks for booking-sensitive changes:

```bash
npm run test -- src/app/api/holds/__tests__/route.test.ts src/app/api/bookings/__tests__/route.test.ts src/lib/booking/__tests__/confirm.test.ts 'src/app/api/bookings/[id]/cancel/__tests__/route.test.ts' src/lib/booking/__tests__/cancel.test.ts
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Run the full Vitest suite when time allows:

```bash
npm run test
```

## Current Known Gaps

- Multi-browser Playwright coverage beyond Chromium desktop.
- Full guest reschedule automation after a confirmed booking.
- Natural five-minute hold expiration waits.
- End-to-end email provider delivery beyond app-side confirmation messaging.
- Live Google/Microsoft calendar provider writes and webhook delivery to an
  external receiver.
