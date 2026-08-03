# Security

OpenSlot stores scheduling and guest booking data in Butterbase. Treat guest
names, emails, notes, timezones, booking times, contact records, and
cancellation tokens as sensitive application data. Treat MCP API tokens as
host account credentials.

For the short repository security policy, see [../SECURITY.md](../SECURITY.md).

## Environment Variables

Core app:

```env
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_BUTTERBASE_APP_ID=...
NEXT_PUBLIC_BUTTERBASE_API_URL=https://api.butterbase.ai
BUTTERBASE_API_KEY=...
SLOT_HOLD_TOKEN_SECRET=...
```

Worker and cron routes:

```env
OUTBOX_PROCESS_SECRET=...
WEBHOOK_PROCESS_SECRET=...
CRON_SECRET=...
CALENDAR_SYNC_SECRET=...
HOLD_EXPIRY_PROCESS_SECRET=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

Calendar OAuth:

```env
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
MICROSOFT_CALENDAR_CLIENT_ID=...
MICROSOFT_CALENDAR_CLIENT_SECRET=...
MICROSOFT_CALENDAR_TENANT=common
CALENDAR_TOKEN_ENCRYPTION_SECRET=...
```

OAuth callbacks validate the signed-in flow state before handling provider
success or denial. Dashboard redirects use the allowlisted application origin
and expose only allowlisted provider/reason codes, never raw provider errors.

Email provider credentials:

```env
EMAIL_PROVIDER=console
EMAIL_FROM=...
RESEND_API_KEY=...
MAILEROO_API_KEY=...
```

Optional runtime controls:

```env
CALENDAR_FINAL_AVAILABILITY_CHECK=stale
CALENDAR_STALE_AFTER_MINUTES=10
BOOKING_AGENT_MODEL=deepseek/deepseek-v4-flash
```

Rules:

- `NEXT_PUBLIC_*` values are browser-visible.
- `BUTTERBASE_API_KEY`, the legacy optional `BUTTERBASE_FUNCTION_SECRET`, and
  `SLOT_HOLD_TOKEN_SECRET` must only be used in server-only code.
- Do not commit `.env.local` or real credentials.

## Butterbase Access Boundaries

- `src/lib/backend/server.ts`: server helpers for request-scoped and service clients.
- `src/lib/backend/compat/query-client.ts`: temporary fluent query compatibility layer.
- `src/lib/backend/compat/browser-client.ts`: browser-safe compatibility client.
- `src/lib/backend/butterbase/*`: Butterbase adapter and HTTP client.

Never import the admin client into a Client Component.

## RLS and Public Access

Provider-neutral RLS and constraint requirements are documented in
`backend/database/migrations/`, `backend/sql/provider-portability.sql`, and
`docs/backend-portability.md`.

Current public access:

- Public profile and event pages are rendered server-side with the service key and return only selected fields.
- Public slot lookup goes through `/api/slots` and returns computed slot times only.
- MCP access goes through `/api/mcp` with host-scoped Bearer tokens. Tool
  execution is scoped to the token's `profile_id`.
- Browser code never receives the Butterbase service key; auth tokens are stored
  in HTTP-only cookies.

The Butterbase service key bypasses RLS and is used only in server-side route
handlers/libraries. Application code must still scope writes by user, MCP token
profile, hold token, or cancellation token.

## Contact Privacy

Contacts are host-scoped aggregates derived from booking attendees. Contact identity uses a deterministic hash of the normalized guest email plus `host_user_id`; raw guest email remains on booking rows and is not stored as a separate contact identity column.

- Hosts can view only contacts whose `host_user_id` belongs to their authenticated profile.
- Booking confirmation, cancellation, and rescheduling update contacts as best-effort derived data after the primary booking mutation succeeds.
- `DELETE /api/contacts/[id]` uses the authenticated profile id plus the server-side anonymization function to mark the contact deleted and scrub matching booking guest display fields, notes, and cancellation reason.
- Deleted contacts are hidden from the dashboard contact list and cannot be viewed through the contact profile route.
- Do not log contact hashes together with raw emails; the pair can become identifying.

## Booking Integrity

Important safeguards:

- `/api/holds` checks overlapping active holds and confirmed bookings.
- `/api/slots` signs short-lived slot hold tokens; use
  `SLOT_HOLD_TOKEN_SECRET` for a dedicated signing secret, or rely on the
  server-only Butterbase secrets fallback.
- `/api/holds` creates the hold through `create_slot_hold_with_reservation()`, which inserts `slot_holds` and `host_reservations` in one database transaction.
- Hold creation, booking confirmation, booking cancellation, and booking
  rescheduling are all atomic Postgres functions:
  `create_slot_hold_with_reservation()`, `public.confirm_booking()`,
  `public.cancel_booking()`, and `reschedule_booking_with_hold()`
  (migration `20260526120000_add_confirm_cancel_booking_functions.sql`).
  Each runs as a single database transaction so a mid-flow failure cannot
  leave partial state behind.
- `public.confirm_booking()` performs the `bookings` insert, the hold
  status flip to `confirmed`, the `host_reservations` hold-to-booking
  conversion, the `booking_events` audit append, and the four
  `outbox_events` side-effect enqueues inside a single database
  transaction. A mid-transaction failure (including a `no_overlapping_bookings`
  23P01 violation) rolls back every side-effect row.
- `public.cancel_booking()` performs the `bookings` status flip to
  `cancelled`, the `host_reservations` release, the `booking_events` audit
  append, and the four `outbox_events` side-effect enqueues inside a single
  database transaction. A mid-transaction failure rolls back every
  side-effect row.
- The 23P01 exclusion violation from `bookings.no_overlapping_bookings`
  is NOT translated inside the RPC; the lib code in
  `src/lib/booking/confirm.ts` and `src/app/api/bookings/error-status.ts`
  maps `error.code === '23P01'` to an HTTP 409 response with the message
  "This slot has been booked by someone else.".
- `public.cancel_booking()` distinguishes distinct failure modes through
  dedicated `RAISE EXCEPTION` codes that the lib and route layer map to
  distinct HTTP responses:
  - `booking_not_found` (P0002) → HTTP 404 "Booking not found".
  - `booking_already_cancelled` (P0001) → HTTP 409 "Booking has already been cancelled".
  - `booking_already_rescheduled` (P0001) → HTTP 409 "Booking has been rescheduled".
  - `invalid_actor_type` (22023) → HTTP 400 (defensive enum check; the
    `booking_events.actor_type` column is constrained to
    `('system', 'host', 'guest')`).
- The `outbox_events.dedupe_key` unique index plus
  `ON CONFLICT (dedupe_key) DO NOTHING` inside both RPCs make retries
  safe. The deterministic dedupe keys are
  `booking:{id}:confirmed`,
  `booking:{id}:calendar-write-requested`,
  `booking:{id}:notifications-requested`,
  `booking:{id}:tenant-webhooks-requested`,
  `booking:{id}:cancelled`,
  `booking:{id}:calendar-cancel-requested`,
  `booking:{id}:notifications-cancel-requested`,
  and `booking:{id}:tenant-webhooks-cancel-requested`. The optional
  reminder is keyed
  `booking:{id}:notifications-reminder-requested` with an
  `available_at` set to `start_at - reminder_minutes_before`. These match
  the dedupe keys the JS helper at `src/lib/outbox/outbox.ts` has always
  used, so any retry path that lands on either side is idempotent.
- The atomicity tests `src/lib/booking/__tests__/confirm.atomic.test.ts`
  and `src/lib/booking/__tests__/cancel.atomic.test.ts` assert that the
  JS lib does NOT re-introduce a multi-step fallback. The lib MUST go
  through the RPC; a JS-side `enqueue*` / `appendBookingEvent` /
  `convertHoldReservationToBooking` / `cancelBookingReservation` /
  direct `outbox_events` / `booking_events` / `host_reservations` write
  will fail the suite.
- The real-DB integration test
  `e2e/integration/confirm-cancel.atomic.test.ts` exercises the same
  contract end-to-end: a 23P01 exclusion violation rolls back every
  side-effect row, a double cancel raises `booking_already_cancelled`
  (P0001) and adds no new rows, and a cancel on a rescheduled booking
  raises `booking_already_rescheduled` (P0001). The integration test is
  gated on the same `NEXT_PUBLIC_BUTTERBASE_APP_ID` and
  `BUTTERBASE_API_KEY` env vars the Playwright E2E suite uses and skips
  cleanly when neither is configured.
- `/api/slots` validates that the event type is active and belongs to the requested host before using service-key reads to compute availability.
- `/api/slots`, `/api/holds`, `/api/bookings`, `/api/bookings/reschedule`, and `/api/bookings/[id]/cancel` consume DB-backed public rate limits before expensive reads or guest mutations. Rate-limit identifiers are hashed before storage.
- Public booking mutations verify Cloudflare Turnstile tokens when `TURNSTILE_SECRET_KEY` is configured. Unconfigured environments skip Turnstile enforcement.
- `confirmBooking()` rejects expired or reused holds.
- `bookings.no_overlapping_bookings` prevents overlapping confirmed bookings at the database level. This is the final guard and MUST NOT be removed.
- `host_reservations_no_overlap` prevents overlapping active host reservations for holds and bookings. This is the final guard and MUST NOT be removed.
- The `cancelBooking()` lib in `src/lib/booking/cancel.ts` does NOT
  perform a host ownership check. Host ownership is the responsibility
  of the host cancellation route in
  `src/app/api/bookings/[id]/cancel/route.ts`, which loads the booking
  through `getAuthenticatedHostCancellation` and compares the supplied
  `cancellation_token` in constant time before calling the lib.
- Hold creation, booking confirmation, cancellation, and rescheduling accept idempotency keys and store only request hashes plus cached responses in `request_idempotency`.
- Booking confirmation, cancellation, and rescheduling enqueue ID-based side-effect events in `outbox_events`; workers should fetch sensitive booking details server-side instead of duplicating guest contact data in the payload.
- `/api/outbox/process` requires `OUTBOX_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-key code to process leased outbox rows.
- `/api/webhooks/process` requires `WEBHOOK_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-key code to process leased webhook delivery rows.
- `/api/calendar/sync` requires `CALENDAR_SYNC_SECRET` or `CRON_SECRET` in production and uses service-key code to refresh provider calendar metadata and busy-cache rows.
- `/api/holds/expire` requires `HOLD_EXPIRY_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-key code to expire stale holds and hold reservations.
- Booking confirmation, cancellation, and rescheduling append ID-based audit events in `booking_events`.
- Cancellation page lookup and cancellation writes use `cancellation_token` rather than only a booking ID.
- Rescheduling page lookup and writes use `reschedule_token` plus a fresh hold token; `reschedule_booking_with_hold()` performs the old/new booking transition and reservation updates in one database transaction.
- MCP booking tools bypass browser Turnstile because they are host-authorized by
  API token, but they still use the same availability, hold, confirmation,
  cancellation, rescheduling, idempotency, rate-limit, reservation, audit,
  contact, and outbox code paths.

Do not weaken any of these without replacing the protection and updating tests.

## MCP Token Security

- MCP tokens are generated with the `os_mcp_` prefix and shown once in Settings.
- Only `token_hash`, a short display prefix, scopes, timestamps, and revocation
  metadata are stored in `mcp_api_tokens`.
- `mcp_api_tokens` has RLS enabled and no direct `anon` or `authenticated`
  grants; dashboard and MCP routes use service-key code after session or token
  authentication.
- Read tools require `mcp:read`; mutation tools require `mcp:write`.
- Booking list tools do not return cancellation or reschedule tokens. Cancel and
  reschedule tools accept `bookingId` and load the required token internally
  after checking host ownership.
- Revoke tokens from Settings immediately if a client machine or config file is
  lost.

## Email Privacy

The default email provider logs messages to the console. `EMAIL_PROVIDER=resend` sends through Resend using server-only `RESEND_API_KEY` and `EMAIL_FROM`. `EMAIL_PROVIDER=maileroo` sends through Maileroo using server-only `MAILEROO_API_KEY` and `EMAIL_FROM`. HTML email templates escape interpolated booking values before rendering.

- Avoid logging full email payloads in production.
- Store provider API keys in server-only environment variables.
- Configure a verified sending domain before enabling a production provider.

## Booking Assistant Privacy

The public booking assistant calls the Butterbase AI gateway only from
server-side route handlers using `BUTTERBASE_API_KEY`. Chat transcripts are not
persisted by OpenSlot. The request sent to the gateway is bounded to recent chat
turns, safe public event context, and guest-provided scheduling preferences or
draft form details. Booking, cancellation, and reschedule tokens are not sent to
the model, and the assistant cannot confirm bookings directly.
`BOOKING_AGENT_MODEL` changes only the model name sent to the Butterbase AI
gateway; it does not change the route's read-only/mutation boundary.

## Browser Security Headers

`next.config.js` applies browser hardening headers to all routes:

- Content Security Policy defaults to same-origin scripts, styles, forms, workers, and manifests; blocks inline script attributes and object content; denies embedding with `frame-ancestors 'none'`; allows Butterbase HTTP/WebSocket connections plus Cloudflare Turnstile challenge script/frame/connect origins; and permits image/media loading from HTTPS so profile avatars and public assets still render.
- Local development adds `localhost`/`127.0.0.1` HTTP and WebSocket allowances plus `unsafe-eval` for the Next.js development runtime. Production omits `unsafe-eval` and adds `upgrade-insecure-requests`.
- Production adds HSTS with `max-age=63072000; includeSubDomains`.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are set alongside the CSP.

Calendar OAuth, email providers, and tenant webhook deliveries are server-side integrations. The browser policy intentionally keeps `connect-src` narrow to `self` and Butterbase rather than allowing Google, Microsoft, email-provider, or arbitrary webhook destination origins directly from client code.

## Integration Secrets

- Calendar provider token columns live in server-only tables without direct `anon` or `authenticated` grants. Application code encrypts OAuth access and refresh tokens before writing them.
- `CALENDAR_TOKEN_ENCRYPTION_SECRET` must be server-only, high entropy, and stable; rotating it requires decrypting/re-encrypting stored provider tokens or asking hosts to reconnect.
- Webhook endpoint `secret_token` values are never returned from list APIs; create returns the secret once so the settings dashboard can show it to the host for verification setup.
- Webhook delivery requests are signed with `X-OpenSlot-Signature` using the endpoint secret and timestamped payload.
- MCP raw tokens are never returned by list APIs; create returns the token once.
- Vercel Cron Jobs should use a random `CRON_SECRET`; manual worker triggers can use route-specific worker secrets.

## Security Review Checklist

- Is the code reachable from the browser?
- Does it import server-only secrets or the admin client?
- Are request bodies validated with Zod?
- Are host writes scoped to the authenticated profile?
- Are guest operations authorized by high-entropy tokens?
- Could logs expose guest email, notes, or tokens?
- Does the change affect RLS policies, constraints, or public reads?

## Related Docs

- [Architecture](architecture.md)
- [MCP](mcp.md)
- [Release](release.md)
- [Troubleshooting](troubleshooting.md)
