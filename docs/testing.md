# Testing

Tests use Vitest with jsdom. Configuration lives in `vitest.config.ts`.

## Commands

```bash
npm run test
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
npm run test -- src/lib/email/__tests__/email.test.ts
npm run test -- src/app/api/calendar/sync/__tests__/route.test.ts
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
- `src/lib/availability/__tests__/` covers slot computation, timezones, buffers, overrides, notice windows, booking windows, and external busy windows.
- `src/lib/booking/__tests__/` covers confirmation, cancellation, and rescheduling engines with mocked Supabase chains.
- `src/lib/booking/__tests__/events.test.ts` covers booking audit event append behavior.
- `src/lib/idempotency/__tests__/` covers request hashing, duplicate replay, and key-conflict behavior.
- `src/lib/outbox/__tests__/` covers outbox dedupe handling and booking side-effect event sets.
- `src/lib/outbox/__tests__/process.test.ts` covers outbox leasing, notification dispatch, completion, and retry failure marking.
- `src/app/api/outbox/process/__tests__/` covers the worker trigger authorization and batch options.
- `src/lib/webhooks/__tests__/deliveries.test.ts` covers webhook delivery enqueueing, signatures, success marking, and retry failure marking.
- `src/lib/webhooks/__tests__/endpoints.test.ts` covers safe webhook endpoint summaries for dashboard/API use.
- `src/app/api/webhooks/process/__tests__/` covers webhook worker trigger authorization and batch options.
- `src/app/api/webhooks/endpoints/__tests__/` covers webhook endpoint creation/listing without exposing secrets.
- `src/lib/calendar/__tests__/` covers safe calendar connection summaries, OAuth URL/token helpers, and provider event API adapters.
- `src/lib/security/__tests__/token-encryption.test.ts` covers OAuth token encryption round trips.
- `src/lib/email/__tests__/email.test.ts` covers templates, console delivery, and the Resend/Maileroo provider adapters.
- `src/app/api/calendar/sync/__tests__/` covers calendar sync worker trigger authorization and batch options.
- `src/app/api/settings/__tests__/` covers authenticated settings persistence and account deletion.
- `src/app/api/holds/__tests__/` covers hold creation through the reservation RPC and conflict mapping.
- `src/app/api/slots/__tests__/` covers service-role slot reads, active host/event scoping, and external busy-cache filtering.
- `src/lib/validations/__tests__/` covers Zod schemas.
- `src/components/ui/__tests__/` covers accessibility and focus behavior.
- Dashboard/public page property tests cover rendering invariants and UI helpers.

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
| Calendar OAuth/provider sync | Calendar OAuth/provider tests, calendar sync route tests, outbox tests, migration review, typecheck |
| Settings persistence | Settings route tests, dashboard smoke/build, typecheck |
| Forms and validation | Schema tests plus component tests |
| Dashboard UI polish | Relevant component/page test, accessibility if inputs/actions change |
| Supabase schema or RLS | Migration review, manual Supabase check, full build/test |
| Docs only | `npm run lint`, `npm run typecheck`, `npm run test` when feasible |

## Related Docs

- [Manual E2E Testing](e2e-testing.md)
- [Development](development.md)
- [Architecture](architecture.md)
- [Troubleshooting](troubleshooting.md)
