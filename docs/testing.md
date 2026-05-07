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
npm run test -- 'src/app/(dashboard)/event-types/[id]/edit/__tests__/edit-event-type-page.test.tsx'
```

## Test Organization

- Unit and property tests live in `__tests__` directories near source files.
- `src/lib/availability/__tests__/` covers slot computation, timezones, buffers, overrides, notice windows, and booking windows.
- `src/lib/booking/__tests__/` covers confirmation and cancellation engines with mocked Supabase chains.
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
| Booking confirmation/cancellation | Booking tests, API-adjacent validation if changed, full test suite |
| Forms and validation | Schema tests plus component tests |
| Dashboard UI polish | Relevant component/page test, accessibility if inputs/actions change |
| Supabase schema or RLS | Migration review, manual Supabase check, full build/test |
| Docs only | `npm run lint`, `npm run typecheck`, `npm run test` when feasible |

## Related Docs

- [Development](development.md)
- [Architecture](architecture.md)
- [Troubleshooting](troubleshooting.md)
