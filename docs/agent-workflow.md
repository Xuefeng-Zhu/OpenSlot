# Agent Workflow

This guide is for autonomous coding agents working in OpenSlot.

## First 10 Minutes

1. Check status:

   ```bash
   git status --short
   ```

2. Read:

   - `README.md`
   - `AGENTS.md`
   - Relevant files under `docs/`
   - Nearby tests for the target area

3. Identify whether the target is live or prototype/mock-backed.

4. Pick one focused change.

## Safe Iteration Loop

1. Explain the issue, why it matters, and files to touch.
2. Edit narrowly.
3. Add or update tests.
4. Run targeted validation.
5. Run broad validation when feasible.
6. Summarize changed files, validation, assumptions, and follow-ups.

## Validation Matrix

| Change type | Minimum validation |
| --- | --- |
| Docs only | `npm run lint`, `npm run typecheck` if feasible |
| Component UI | Targeted test, `npm run lint`, `npm run typecheck` |
| Form validation | Schema/component tests, full test suite |
| API route | Unit/route-adjacent tests, full test suite, build |
| Booking/availability logic | Targeted tests, property tests, full test suite, build |
| Backend schema/function change | Provider artifact review, Butterbase test-app check when available, full validation |

## High-Risk Areas

- `src/lib/availability/compute-slots.ts`
- `src/lib/booking/confirm.ts`
- `src/lib/booking/cancel.ts`
- `src/app/api/holds/route.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/availability/route.ts`
- `backend/database/migrations/`
- `backend/sql/provider-portability.sql`
- `src/lib/backend/*`
- `src/lib/supabase/admin.ts` legacy shim behavior

## Do Not

- Do not expose `BUTTERBASE_API_KEY`.
- Do not remove RLS or database constraints to make tests pass.
- Do not assume mock dashboard pages are persisted.
- Do not rewrite large components just to clean style.
- Do not add deployment instructions for platforms not configured in the repo.
- Do not invent an email provider, calendar sync, or payment flow.

## Good Follow-Up Notes

Use a follow-up when a useful improvement is outside your safe scope:

- `TODO: add CI workflow once deployment target is chosen.`

## Related Docs

- [Contributing](contributing.md)
- [Troubleshooting](troubleshooting.md)
- [Security](security.md)
