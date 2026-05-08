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

Current public reads:

- Profiles with usernames are publicly readable.
- Active event types are publicly readable.

Service role policies are permissive by design because service role bypasses RLS. Application code must still scope writes by user, hold token, or cancellation token.

## Booking Integrity

Important safeguards:

- `/api/holds` checks overlapping active holds and confirmed bookings.
- `confirmBooking()` rejects expired or reused holds.
- `bookings.no_overlapping_bookings` prevents overlapping confirmed bookings at the database level.
- Booking confirmation and cancellation accept idempotency keys and store only request hashes plus cached responses in `request_idempotency`.
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
