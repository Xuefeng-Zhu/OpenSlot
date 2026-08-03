# E2E Testing

OpenSlot has a committed Playwright E2E lane for the core public, guest, and
authenticated host journeys. The suite runs against a configured Butterbase
test app, creates isolated rows for mutating flows, and cleans those rows with
the server-only Butterbase service key.

## Automated Dashboard E2E

The automated suite first tries this Butterbase-backed host account before
browser specs run:

- Email: `demo@openslot.dev`
- Password: `demo-password-123`

Run it locally with:

```bash
npm run test:e2e
```

Useful development modes:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
```

The Playwright config starts the Next.js dev server when
`PLAYWRIGHT_BASE_URL` is local, defaulting to `http://127.0.0.1:3000`. Use
another port, for example `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100`, when
port 3000 is already occupied. Local E2E setup does not require any additional
mutation opt-in. The suite expects `NEXT_PUBLIC_BUTTERBASE_APP_ID` and
`BUTTERBASE_API_KEY` to be available in the shell or `.env.local`. Before tests
run, Playwright verifies the demo host password through the real Butterbase Auth
password flow. If the fixed demo auth user is stale and the configured
Butterbase app supports auth-user admin functions, setup refreshes or recreates
that auth user. If those admin functions are not available, setup provisions a
disposable runtime demo login, stores it under the gitignored `.e2e-auth/`
directory, and keeps the public `/demo` profile, default schedule, and weekday
availability aligned with that auth user.

### External deployment safety

The full suite writes and deletes fixture data. Run it against an external
deployment only when that deployment and its Butterbase app are disposable QA
resources. External targets must use HTTPS and require an explicit, per-command
opt-in:

```bash
E2E_ALLOW_EXTERNAL_MUTATIONS=true \
PLAYWRIGHT_BASE_URL=https://qa.openslot.example \
npm run test:e2e
```

Do not store `E2E_ALLOW_EXTERNAL_MUTATIONS` in `.env.local`, and do not use the
full automated suite against production. Before any auth or database fixture
setup, Playwright fetches the deployment and compares its public
`X-OpenSlot-Butterbase-App-Id` response header with the locally configured
`NEXT_PUBLIC_BUTTERBASE_APP_ID`. Missing or mismatched identity fails closed
without changing external data. Deploy the current app build before using this
mode so the identity header is present.

Override the login used by browser specs with `E2E_DEMO_HOST_EMAIL`,
`E2E_DEMO_HOST_PASSWORD`, and `E2E_DEMO_AUTH_USER_ID` when a shared Butterbase
test app already has known seeded credentials. The legacy aliases
`E2E_DEMO_EMAIL` and `E2E_DEMO_PASSWORD` are still honored. Set
`E2E_DEMO_HOST_FILE` to change where the disposable runtime login is cached;
the default is `.e2e-auth/demo-host.json`. Set `E2E_DEMO_AUTH_STATE_FILE` to
change where the reusable browser session is cached; the default is
`.e2e-auth/demo-auth-state.json`.

The CI `Dashboard E2E` job installs Chromium and runs `npm run test:e2e` when
the Butterbase app id and service key are configured for the repository. If
those secrets are absent, the job reports a notice and skips the browser lane
instead of attempting to run against an unconfigured backend.

## Automated Coverage

| Priority | Area | Automated coverage |
| --- | --- | --- |
| P0 | App/public smoke | Landing, legal, auth, public profile/event, cancellation token, reschedule token, authenticated dashboard pages, and no browser console/page errors. |
| P0 | Auth/access control | Signed-out redirects, login field validation, invalid credentials, valid demo login, return URL handling, and session persistence after reload. |
| P0 | Event types | Validation, create, reload persistence, public URL visibility, edit, pause, public hiding, delete, search, and status filters. |
| P0 | Guest booking | Public slot lookup, date/time selection, booking form validation, booking confirmation, cancel/reschedule links, host booking visibility, and stale-slot conflict handling without duplicate bookings. |
| P1 | Bookings | Event-type filtering, details drawer, host cancellation dialog, cancelled tab, and database status/reason verification. |
| P1 | Contacts | Search no-match/match states and contact profile meeting history for an isolated booking. |
| P1 | Availability | Invalid interval validation, discard behavior, date override save, reload persistence, and service-key restoration. |
| P1 | Profile/settings | Profile save with public profile persistence, display preference persistence, and service-key restoration. |
| P1 | Webhooks | Invalid URL handling, create, one-time signing secret, pause, enable, delete, and cleanup. |
| P1 | Mobile nav | Narrow viewport dashboard drawer navigation to primary pages. |
| P2 | Onboarding/token edges | Non-mutating onboarding validation/back flow and safe invalid guest action links. |

Mutating specs create unique event types, bookings, contacts, availability
overrides, or webhook endpoints. Cleanup runs in `finally` blocks.

## Manual Prerequisites

1. Install dependencies and configure `.env.local`.
2. Configure `.env.local` with a disposable Butterbase test app and service key.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Use a test host account with:
   - A completed profile.
   - At least one active event type.
   - Availability that exposes future slots.
   - Butterbase service key configured for booking writes and cleanup.

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
