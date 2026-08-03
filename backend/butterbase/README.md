# Butterbase Backend Artifacts

Butterbase is the active OpenSlot backend. App runtime code talks to Butterbase
through `src/lib/backend/`; this directory records the provider-owned backend
artifacts that must exist in the configured Butterbase app.

## Runtime Contract

- Data API: OpenSlot uses the Butterbase REST row API under
  `/v1/{app_id}/{table}` for table reads and writes.
- Auth API: OpenSlot uses Butterbase email/password auth endpoints and stores
  access/refresh tokens in HTTP-only app cookies.
- Functions API: OpenSlot invokes HTTP functions at
  `/v1/{app_id}/fn/{function_name}` for atomic booking and worker operations.
- Service key: `BUTTERBASE_API_KEY` stays server-only and maps to the
  provider service role that can bypass RLS.
- Function secret: `BUTTERBASE_FUNCTION_SECRET` is a separate server-only
  bearer token. Deploy it to each Butterbase function as
  `OPEN_SLOT_FUNCTION_SECRET`.

## Required Functions

The app expects the slugs listed in `functions.json`. These functions must
preserve the transaction semantics documented in
`../sql/provider-portability.sql`, especially:

- hold creation and rescheduling reserve host time atomically;
- `confirm-booking` and `cancel-booking` are atomic Postgres functions
  (`public.confirm_booking()` and `public.cancel_booking()` from
  migration `20260526120000_add_confirm_cancel_booking_functions.sql`)
  that perform the `bookings` row write, the `host_reservations` mirror
  write, the `booking_events` audit append, and the four `outbox_events`
  side-effect enqueues inside a single database transaction. A
  mid-transaction failure (including a `no_overlapping_bookings` 23P01
  violation) rolls back every side-effect row. JS-side outbox/contact
  work is best-effort and runs after the transaction commits.
- `confirm-booking` does NOT translate the 23P01 exclusion violation; the
  lib code in `src/lib/booking/confirm.ts` and the route handler in
  `src/app/api/bookings/error-status.ts` map `error.code === '23P01'` to
  HTTP 409 "This slot has been booked by someone else.". `cancel-booking`
  raises dedicated error codes (`booking_not_found`, `booking_already_cancelled`,
  `booking_already_rescheduled`, `invalid_actor_type`) so the lib can
  surface distinct HTTP responses.
- the `outbox_events.dedupe_key` unique index plus
  `ON CONFLICT (dedupe_key) DO NOTHING` inside both RPCs make retries
  safe; the deterministic dedupe keys
  (`booking:{id}:confirmed`, `booking:{id}:cancelled`, and the
  matching `calendar.*.requested`, `notifications.*.requested`,
  `tenant.webhooks.*.requested`, and `notifications.reminder.requested`
  variants) match the keys the JS helper at
  `src/lib/outbox/outbox.ts` has always used, so retries that race
  against the JS path are still safe.
- worker claim functions lease rows with skip-locked semantics;
- public rate-limit and stale-hold expiry functions remain atomic.
- `save-availability` owns the schedule/rules/overrides batch write. Deploy
  `functions/save-availability.v1.ts` under that exact slug. Its HTTP trigger
  must require authentication and disable service-key impersonation; the
  handler accepts only Butterbase-verified `service_key` callers through
  `ctx.caller`. Strict payload validation and one parameterized data-modifying
  CTE gate every mutation on `(schedule_id, user_id)` ownership, update the
  schedule timezone, delete requested owned rows, and upsert all supplied
  rules and overrides atomically. The browser supplies the schedule version it
  loaded; the function advances a millisecond-precision monotonic `updated_at`
  version and returns `409` when another writer wins first.
- `save-dashboard-preferences` owns the cross-table display-preference write.
  Deploy `functions/save-dashboard-preferences.v1.ts` under that exact slug.
  Its HTTP trigger must require authentication and disable service-key
  impersonation; the handler accepts only Butterbase-verified `service_key`
  callers through `ctx.caller`.
  Its single parameterized data-modifying CTE updates `profiles.default_timezone`
  and upserts the matching `user_settings` formats atomically, so a failed
  settings write cannot leave a profile-only timezone change behind.

Keep this manifest in sync with `src/lib/backend/functions.ts`.
