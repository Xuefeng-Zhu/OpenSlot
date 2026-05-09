# Manual E2E Testing

OpenSlot does not currently have a committed Playwright or Cypress E2E
runner. Use this manual browser suite for release smoke testing and for
validating scheduling flows against a Supabase-backed environment.

## Prerequisites

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

## Core Manual Suite

Run the suite in a real browser and check console/server logs while testing.
Clean up temporary event types, bookings, and webhook endpoints before handing
off.

| Area | Scenario | Expected result |
| --- | --- | --- |
| Public pages | Load `/`, `/signup`, `/terms`, `/privacy`, `/login` | Pages render meaningful content with no framework overlay or console errors. |
| Auth | Submit invalid login credentials, then valid test credentials | Invalid login shows an error; valid login reaches `/dashboard`. |
| Dashboard smoke | Visit `/dashboard`, `/event-types`, `/availability`, `/bookings`, `/profile`, `/settings` | Each authenticated route renders its primary heading and has no console errors. |
| Event types | Create a temporary active event type | The event appears in `/event-types` and on the public profile. |
| Event types | Search by title and edit the temporary event type | Search narrows to the event; edit persists after save. |
| Public booking | Open the public profile and temporary event page | The event is visible and loads the date picker. |
| Public booking | Pick a date and slot | Available times load; selecting a slot creates a hold and opens the booking form. |
| Booking form | Submit empty required fields | Name and email validation messages appear. |
| Booking confirm | Submit valid guest details | The confirmation screen appears with cancel and reschedule links. |
| Host bookings | Open `/bookings` after confirmation | The booking appears under Upcoming with confirmed status. |
| Reschedule | Use the guest reschedule link and choose a new slot | The reschedule confirmation appears and the host dashboard shows the new date/time. |
| Cancellation | Use the guest cancellation link | The cancellation confirmation appears; Upcoming is cleared and Cancelled shows the booking. |
| Event cleanup | Delete the temporary event type | The event no longer appears in dashboard search or on the public profile. |
| Webhooks | In Settings > Integrations, create and delete a temporary webhook endpoint | A one-time signing secret appears after create; delete removes the endpoint and the secret banner. |
| Mobile smoke | Set a narrow viewport and open a public event page | Date picker and available-time list remain usable with no console errors. |

## Validation Commands

Run the focused checks for booking-sensitive changes:

```bash
npm run test -- src/app/api/holds/__tests__/route.test.ts src/app/api/bookings/__tests__/route.test.ts src/lib/booking/__tests__/confirm.test.ts 'src/app/api/bookings/[id]/cancel/__tests__/route.test.ts' src/lib/booking/__tests__/cancel.test.ts
npm run lint
npm run typecheck
npm run build
```

Run the full suite when time allows:

```bash
npm run test
```

## Latest Manual Run

Date: May 9, 2026

Environment:
- Branch: `codex/calendar-busy-slot-filter`
- URL: `http://localhost:3000`
- Browser: Codex in-app browser
- Desktop viewport plus mobile `390x844`
- Database migrations applied through `20260509000000_fix_hold_rpc_expires_at`

Result:
- 27 of 28 checks passed.
- 1 follow-up issue found and documented below.
- Temporary QA event type, webhook endpoint, and related bookings were cleaned up.
- Browser console checks were clean for passing flows.
- Server logs showed expected 2xx responses for slots, holds, bookings,
  rescheduling, cancellation, event-type CRUD, and webhook CRUD.

Issue found:
- Event Types search only matches the event title. It does not match the
  visible slug text shown on each card, so searching for `qa-e2e-*` returned
  "No event types match your filters" while searching by title worked.

Fix validated during this run:
- Guest hold creation previously failed with Postgres error `42702` because
  `expires_at` was ambiguous inside `create_slot_hold_with_reservation`.
  Migration `20260509000000_fix_hold_rpc_expires_at.sql` qualifies those
  references and allowed the full hold -> confirm -> reschedule -> cancel flow
  to pass.

Not covered in this run:
- Multi-browser coverage outside the Codex in-app browser.
- Concurrent double-booking from two independent sessions.
- Waiting for a hold to expire naturally after five minutes.
- End-to-end email provider delivery beyond app-side confirmation messaging.
- Live calendar provider event creation/cancellation side effects.
