# Security

OpenSlot stores scheduling and guest booking data in Supabase. Treat guest names, emails, notes, timezones, booking times, and cancellation tokens as sensitive application data.

## Environment Variables

Required:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=...
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
- Booking confirmation and cancellation accept idempotency keys and store only request hashes plus cached responses in `request_idempotency`.
- Booking confirmation and cancellation enqueue ID-based side-effect events in `outbox_events`; workers should fetch sensitive booking details server-side instead of duplicating guest contact data in the payload.
- Cancellation page lookup and cancellation writes use `cancellation_token` rather than only a booking ID.

Do not weaken any of these without replacing the protection and updating tests.

## Email Privacy

The current email provider logs messages to the console. Before adding a production provider:

- Confirm user-provided content is escaped or sanitized in HTML templates.
- Avoid logging full email payloads in production.
- Store provider API keys in server-only environment variables.
- Update `src/lib/email/send.ts`, `.env.example`, and these docs.

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
