# Security

OpenSlot stores scheduling and guest booking data in Butterbase. Treat guest
names, emails, notes, timezones, booking times, contact records, and
cancellation tokens as sensitive application data.

For the short repository security policy, see [../SECURITY.md](../SECURITY.md).

## Environment Variables

Core app:

```env
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_BUTTERBASE_APP_ID=...
NEXT_PUBLIC_BUTTERBASE_API_URL=https://api.butterbase.ai
BUTTERBASE_API_KEY=...
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

Email provider credentials:

```env
EMAIL_PROVIDER=console
EMAIL_FROM=...
RESEND_API_KEY=...
MAILEROO_API_KEY=...
```

Rules:

- `NEXT_PUBLIC_*` values are browser-visible.
- `BUTTERBASE_API_KEY` must only be used in server-only code.
- Do not commit `.env.local` or real credentials.

## Butterbase Access Boundaries

- `src/lib/backend/server.ts`: server helpers for request-scoped and service clients.
- `src/lib/backend/compat/query-client.ts`: temporary fluent query compatibility layer.
- `src/lib/backend/butterbase/*`: Butterbase adapter and HTTP client.
- `src/lib/supabase/*`: legacy import-path shims that delegate to Butterbase.

Never import the admin client into a Client Component.

## RLS and Public Access

Provider-neutral RLS and constraint requirements are documented in
`backend/sql/provider-portability.sql` and `docs/backend-portability.md`.

Current public access:

- Public profile and event pages are rendered server-side with the service key and return only selected fields.
- Public slot lookup goes through `/api/slots` and returns computed slot times only.
- Browser code never receives the Butterbase service key; auth tokens are stored
  in HTTP-only cookies.

The Butterbase service key bypasses RLS and is used only in server-side route handlers/libraries. Application code must still scope writes by user, hold token, or cancellation token.

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
- `/api/holds` creates the hold through `create_slot_hold_with_reservation()`, which inserts `slot_holds` and `host_reservations` in one database transaction.
- `/api/slots` validates that the event type is active and belongs to the requested host before using service-key reads to compute availability.
- `/api/slots`, `/api/holds`, `/api/bookings`, `/api/bookings/reschedule`, and `/api/bookings/[id]/cancel` consume DB-backed public rate limits before expensive reads or guest mutations. Rate-limit identifiers are hashed before storage.
- Public booking mutations verify Cloudflare Turnstile tokens when `TURNSTILE_SECRET_KEY` is configured. Unconfigured environments skip Turnstile enforcement.
- `confirmBooking()` rejects expired or reused holds.
- `bookings.no_overlapping_bookings` prevents overlapping confirmed bookings at the database level.
- `host_reservations_no_overlap` prevents overlapping active host reservations for holds and bookings.
- Hold creation, booking confirmation, cancellation, and rescheduling accept idempotency keys and store only request hashes plus cached responses in `request_idempotency`.
- Booking confirmation, cancellation, and rescheduling enqueue ID-based side-effect events in `outbox_events`; workers should fetch sensitive booking details server-side instead of duplicating guest contact data in the payload.
- `/api/outbox/process` requires `OUTBOX_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-key code to process leased outbox rows.
- `/api/webhooks/process` requires `WEBHOOK_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-key code to process leased webhook delivery rows.
- `/api/calendar/sync` requires `CALENDAR_SYNC_SECRET` or `CRON_SECRET` in production and uses service-key code to refresh provider calendar metadata and busy-cache rows.
- `/api/holds/expire` requires `HOLD_EXPIRY_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-key code to expire stale holds and hold reservations.
- Booking confirmation, cancellation, and rescheduling append ID-based audit events in `booking_events`.
- Cancellation page lookup and cancellation writes use `cancellation_token` rather than only a booking ID.
- Rescheduling page lookup and writes use `reschedule_token` plus a fresh hold token; `reschedule_booking_with_hold()` performs the old/new booking transition and reservation updates in one database transaction.

Do not weaken any of these without replacing the protection and updating tests.

## Email Privacy

The default email provider logs messages to the console. `EMAIL_PROVIDER=resend` sends through Resend using server-only `RESEND_API_KEY` and `EMAIL_FROM`. `EMAIL_PROVIDER=maileroo` sends through Maileroo using server-only `MAILEROO_API_KEY` and `EMAIL_FROM`. HTML email templates escape interpolated booking values before rendering.

- Avoid logging full email payloads in production.
- Store provider API keys in server-only environment variables.
- Configure a verified sending domain before enabling a production provider.

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
- [Release](release.md)
- [Troubleshooting](troubleshooting.md)
