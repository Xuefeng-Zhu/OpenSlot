# Testing

Unit, property, and component tests use Vitest with jsdom. Configuration lives
in `vitest.config.ts`. Browser E2E user-journey tests use Playwright with local
Supabase seed data. Configuration lives in `playwright.config.ts`.

## Commands

```bash
npm run test
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
npm run test:watch
npm run lint
npm run typecheck
npm run build
```

Targeted tests:

```bash
npm run test -- src/lib/availability/__tests__/compute-slots.test.ts
npm run test -- src/lib/booking/__tests__/confirm.test.ts
npm run test -- src/lib/booking/__tests__/reschedule.test.ts
npm run test -- src/lib/booking/__tests__/events.test.ts
npm run test -- src/lib/outbox/__tests__/outbox.test.ts
npm run test -- src/lib/outbox/__tests__/process.test.ts
npm run test -- src/lib/webhooks/__tests__/deliveries.test.ts
npm run test -- src/lib/webhooks/__tests__/endpoints.test.ts
npm run test -- src/lib/calendar/__tests__/connections.test.ts
npm run test -- src/lib/calendar/__tests__/oauth.test.ts
npm run test -- src/lib/calendar/__tests__/provider-sync.test.ts
npm run test -- src/lib/security/__tests__/token-encryption.test.ts
npm run test -- src/lib/security/__tests__/rate-limit.test.ts
npm run test -- src/lib/security/__tests__/turnstile.test.ts
npm run test -- src/lib/email/__tests__/email.test.ts
npm run test -- src/app/api/calendar/sync/__tests__/route.test.ts
npm run test -- src/app/api/holds/expire/__tests__/route.test.ts
npm run test -- src/lib/idempotency/__tests__/request-idempotency.test.ts
npm run test -- src/app/api/outbox/process/__tests__/route.test.ts
npm run test -- src/app/api/webhooks/process/__tests__/route.test.ts
npm run test -- src/app/api/webhooks/endpoints/__tests__/route.test.ts
npm run test -- src/app/api/settings/__tests__/route.test.ts
npm run test -- src/app/api/holds/__tests__/route.test.ts
npm run test -- src/app/api/slots/__tests__/route.test.ts
npm run test -- src/app/api/bookings/__tests__/route.test.ts
npm run test -- 'src/app/api/bookings/[id]/cancel/__tests__/route.test.ts'
npm run test -- 'src/app/(dashboard)/event-types/[id]/edit/__tests__/edit-event-type-page.test.tsx'
```

## Test Organization

- Unit and property tests live in `__tests__` directories near source files.
- Browser E2E specs live in `e2e/` and are excluded from Vitest.
- `src/lib/availability/__tests__/` covers slot computation, timezones, buffers, overrides, notice windows, booking windows, and external busy windows.
- `src/lib/booking/__tests__/` covers confirmation, cancellation, and rescheduling engines with mocked Supabase chains.
- `src/lib/booking/__tests__/events.test.ts` covers booking audit event append behavior.
- `src/lib/idempotency/__tests__/` covers request hashing, duplicate replay, and key-conflict behavior.
- `src/lib/outbox/__tests__/` covers outbox dedupe handling, booking side-effect event sets, and scheduled reminder enqueueing.
- `src/lib/outbox/__tests__/process.test.ts` covers outbox leasing, notification/reminder dispatch, stale reminder suppression, completion, and retry failure marking.
- `src/app/api/outbox/process/__tests__/` covers the worker trigger authorization and batch options.
- `src/lib/webhooks/__tests__/deliveries.test.ts` covers webhook delivery enqueueing, signatures, success marking, and retry failure marking.
- `src/lib/webhooks/__tests__/endpoints.test.ts` covers safe webhook endpoint summaries for dashboard/API use.
- `src/app/api/webhooks/process/__tests__/` covers webhook worker trigger authorization and batch options.
- `src/app/api/webhooks/endpoints/__tests__/` covers webhook endpoint creation/listing without exposing secrets.
- `src/lib/calendar/__tests__/` covers safe calendar connection summaries, OAuth URL/token helpers, provider watch/subscription validation, stale-cache final availability checks, and provider event API adapters including generated Meet/Teams links.
- `src/lib/security/__tests__/` covers OAuth token encryption, public rate-limit request hashing/response metadata, and optional Turnstile verification.
- `src/lib/email/__tests__/email.test.ts` covers booking lifecycle/reminder templates, generated conference link rendering, console delivery, and the Resend/Maileroo provider adapters.
- `src/app/api/calendar/sync/__tests__/` covers calendar sync worker trigger authorization and batch options.
- `src/app/api/settings/__tests__/` covers authenticated settings persistence and account deletion.
- `src/app/api/holds/__tests__/` covers hold creation through the reservation RPC, idempotency replay/conflict handling, public rate limiting, Turnstile preflight, and conflict mapping.
- `src/app/api/holds/expire/__tests__/` covers stale hold expiry worker authorization and bounded batch options.
- `src/app/api/slots/__tests__/` covers service-role slot reads, public rate limiting, active host/event scoping, and external busy-cache filtering.
- `src/lib/validations/__tests__/` covers Zod schemas.
- `src/components/ui/__tests__/` covers accessibility and focus behavior.
- Dashboard/public page property tests cover rendering invariants and UI helpers.
- `e2e/pages.spec.ts` smokes public pages, seeded public booking pages,
  token pages, and authenticated dashboard pages.
- `e2e/auth.spec.ts` covers access control, login validation, and session
  persistence.
- `e2e/event-types.spec.ts` covers host event type validation, create, edit,
  pause, delete, search, and filters.
- `e2e/guest-booking.spec.ts` covers public guest booking validation,
  confirmation, host visibility, and stale-slot conflict handling.
- `e2e/host-dashboard.spec.ts` covers booking cancellation, contact search and
  history, availability overrides, profile/settings persistence, webhook CRUD,
  and mobile dashboard navigation.
- `e2e/onboarding.spec.ts` covers non-mutating onboarding wizard validation.
- `e2e/public-edge.spec.ts` covers safe invalid guest action links.

## E2E Tests

The committed Playwright lane covers core public, guest, and authenticated host
journeys against a local Supabase database. It runs in CI through the
`Dashboard E2E` job.
For local runs, start and seed Supabase before running the test:

```bash
supabase start
supabase db reset --local
npm run test:e2e
```

The suite loads `.env.local` and uses the configured service-role key during
Playwright setup to refresh and verify the demo host password before the browser
login tests run. If the demo host is missing, setup creates the auth user,
profile, a default schedule, and weekday availability needed by isolated E2E
specs. Mutating specs create unique event types, bookings, availability
schedules, and webhook endpoints, then clean them with the service-role key.

If Chromium has not been installed on the machine yet, run:

```bash
npx playwright install chromium
```

Use the helper scripts while developing a failing flow:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:debug
```

## Property-Based Tests

The suite uses `fast-check` for invariants such as:

- No overlapping availability output.
- Bounded dashboard booking lists.
- Booking category/filter correctness.
- Valid slugs and schema behavior.
- Timezone selector and hold timer behavior.

When changing core scheduling behavior, prefer property tests plus a few named examples for DST or edge cases.

## Accessibility Tests

`jest-axe` is used in UI tests for form labels and icon accessibility. When adding inputs, ensure each has either:

- A `Label` with matching `htmlFor`/`id`, or
- A clear `aria-label`.

## Known Test Output

The full suite may print:

```text
Not implemented: navigation to another Document
```

This comes from jsdom when a test triggers browser navigation. It is currently non-fatal if Vitest exits successfully.

## What to Test for Common Changes

| Change | Recommended validation |
| --- | --- |
| Slot computation, buffers, notice windows | Availability unit + property tests, full test suite |
| Public slot API | Slot route tests, availability unit tests, RLS/grants migration review |
| Hold creation or reservation conflicts | Hold route tests, booking tests, migration review, full test suite |
| Booking confirmation/cancellation/rescheduling | Booking tests, outbox tests, idempotency tests, API-adjacent validation if changed, full test suite |
| Outbox processing | Outbox process tests, worker route tests, email tests, full test suite |
| Webhook delivery | Webhook delivery tests, webhook worker route tests, endpoint API tests, full test suite |
| Calendar OAuth/provider sync | Calendar OAuth/provider tests, calendar sync route tests, outbox tests, email rendering tests for generated links, migration review, typecheck |
| Settings persistence | Settings route tests, dashboard smoke/build, typecheck |
| Forms and validation | Schema tests plus component tests |
| Dashboard UI polish | Relevant component/page test, accessibility if inputs/actions change |
| Page smoke, authenticated dashboard behavior, guest booking, or E2E regressions | `npm run test:e2e` with local Supabase seed data |
| Supabase schema or RLS | Migration review, manual Supabase check, full build/test |
| Docs only | `npm run lint`, `npm run typecheck`, `npm run test` when feasible |

## Related Docs

- [E2E Testing](e2e-testing.md)
- [Development](development.md)
- [Architecture](architecture.md)
- [Troubleshooting](troubleshooting.md)
