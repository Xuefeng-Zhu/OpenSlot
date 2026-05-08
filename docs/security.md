# Security

OpenSlot stores scheduling and guest booking data in Supabase. Treat guest names, emails, notes, timezones, booking times, and cancellation tokens as sensitive application data.

## Environment Variables

Required:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=...
OUTBOX_PROCESS_SECRET=...
WEBHOOK_PROCESS_SECRET=...
CRON_SECRET=...
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
MICROSOFT_CALENDAR_CLIENT_ID=...
MICROSOFT_CALENDAR_CLIENT_SECRET=...
CALENDAR_TOKEN_ENCRYPTION_SECRET=...
CALENDAR_SYNC_SECRET=...
EMAIL_PROVIDER=console
EMAIL_FROM=...
RESEND_API_KEY=...
```

Rules:

- `NEXT_PUBLIC_*` values are browser-visible.
- `SUPABASE_SERVICE_ROLE_KEY` must only be used in server-only code.
- Do not commit `.env.local` or real credentials.

## Supabase Access Boundaries

- `src/lib/supabase/client.ts`: browser client with anon key.
- `src/lib/supabase/server.ts`: server client with cookie session and anon key.
- `src/lib/supabase/admin.ts`: service role client for route handlers and server-only libraries.

Never import the admin client into a Client Component.

## RLS and Public Access

RLS policies are in `supabase/migrations/008_create_rls_policies.sql`.
Explicit Data API grants are in `supabase/migrations/20260508063319_add_explicit_data_api_grants.sql`.

Current public access:

- Public profile and event pages are rendered server-side with the service role and return only selected fields.
- Public slot lookup goes through `/api/slots` and returns computed slot times only.
- App tables are not directly exposed to `anon`.

The service role bypasses RLS and is used only in server-side route handlers/libraries. Application code must still scope writes by user, hold token, or cancellation token.

## Booking Integrity

Important safeguards:

- `/api/holds` checks overlapping active holds and confirmed bookings.
- `/api/holds` creates the hold through `create_slot_hold_with_reservation()`, which inserts `slot_holds` and `host_reservations` in one database transaction.
- `/api/slots` validates that the event type is active and belongs to the requested host before using service-role reads to compute availability.
- `confirmBooking()` rejects expired or reused holds.
- `bookings.no_overlapping_bookings` prevents overlapping confirmed bookings at the database level.
- `host_reservations_no_overlap` prevents overlapping active host reservations for holds and bookings.
- Booking confirmation, cancellation, and rescheduling accept idempotency keys and store only request hashes plus cached responses in `request_idempotency`.
- Booking confirmation, cancellation, and rescheduling enqueue ID-based side-effect events in `outbox_events`; workers should fetch sensitive booking details server-side instead of duplicating guest contact data in the payload.
- `/api/outbox/process` requires `OUTBOX_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-role code to process leased outbox rows.
- `/api/webhooks/process` requires `WEBHOOK_PROCESS_SECRET` or `CRON_SECRET` in production and uses service-role code to process leased webhook delivery rows.
- `/api/calendar/sync` requires `CALENDAR_SYNC_SECRET` or `CRON_SECRET` in production and uses service-role code to refresh provider calendar metadata and busy-cache rows.
- Booking confirmation, cancellation, and rescheduling append ID-based audit events in `booking_events`.
- Cancellation page lookup and cancellation writes use `cancellation_token` rather than only a booking ID.
- Rescheduling page lookup and writes use `reschedule_token` plus a fresh hold token; `reschedule_booking_with_hold()` performs the old/new booking transition and reservation updates in one database transaction.

Do not weaken any of these without replacing the protection and updating tests.

## Email Privacy

The default email provider logs messages to the console. `EMAIL_PROVIDER=resend` sends through Resend using server-only `RESEND_API_KEY` and `EMAIL_FROM`. HTML email templates escape interpolated booking values before rendering.

- Avoid logging full email payloads in production.
- Store provider API keys in server-only environment variables.
- Configure a verified sending domain before enabling a production provider.

## Integration Secrets

- Calendar provider token columns live in server-only tables without direct `anon` or `authenticated` grants. Application code encrypts OAuth access and refresh tokens before writing them.
- `CALENDAR_TOKEN_ENCRYPTION_SECRET` must be server-only, high entropy, and stable; rotating it requires decrypting/re-encrypting stored provider tokens or asking hosts to reconnect.
- Webhook endpoint `secret_token` values are never returned from list APIs; create returns the secret once so the host can configure verification.
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
