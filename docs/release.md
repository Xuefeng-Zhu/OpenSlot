# Release and Build Notes

There is no committed GitHub Actions workflow in this repository. The repository includes Vercel cron configuration for worker routes, but any production deploy still needs the required environment variables and database migrations applied out of band.

## Release Gate

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

The production build command is:

```bash
npm run build
```

It maps to:

```bash
next build --webpack
```

## Runtime Start

After a successful build:

```bash
npm run start
```

## Required Production Configuration

The production environment must provide:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://your-production-origin.example
OUTBOX_PROCESS_SECRET=...
WEBHOOK_PROCESS_SECRET=...
CRON_SECRET=...
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
MICROSOFT_CALENDAR_CLIENT_ID=...
MICROSOFT_CALENDAR_CLIENT_SECRET=...
MICROSOFT_CALENDAR_TENANT=common
CALENDAR_TOKEN_ENCRYPTION_SECRET=...
CALENDAR_SYNC_SECRET=...
EMAIL_PROVIDER=console
EMAIL_FROM="OpenSlot <bookings@example.com>"
RESEND_API_KEY=...
MAILEROO_API_KEY=...
```

`NEXT_PUBLIC_APP_URL` is used when generating cancellation, rescheduling, and OAuth callback URLs. `OUTBOX_PROCESS_SECRET`, `WEBHOOK_PROCESS_SECRET`, and `CALENDAR_SYNC_SECRET` protect manual worker POSTs. `CRON_SECRET` protects Vercel Cron GET invocations.

`CALENDAR_TOKEN_ENCRYPTION_SECRET` encrypts stored per-user OAuth access and refresh tokens before persistence. Use a high-entropy server-only value and keep it stable across deploys.

Generated Google Meet and Microsoft Teams links depend on the existing Google/Microsoft calendar OAuth credentials and writable provider calendars. No separate Zoom or video-provider secret is required for the v1 video integration.

Set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY` to send production booking emails through Resend. Set `EMAIL_PROVIDER=maileroo`, `EMAIL_FROM`, and `MAILEROO_API_KEY` to send through Maileroo. Leave `EMAIL_PROVIDER` unset or set to `console` to log emails instead.

## Worker Triggers

`vercel.json` configures Vercel Cron Jobs for:

- `GET /api/outbox/process`
- `GET /api/webhooks/process`
- `GET /api/calendar/sync`

Vercel sends `CRON_SECRET` as a bearer token when that project environment variable is configured. Non-Vercel deployments should configure an equivalent scheduler that calls the same routes with `Authorization: Bearer <secret>`.

The outbox worker must run for generated conference links and booking notification emails to complete. Video-provider bookings remain confirmed while conference link creation is pending or retrying.

## Database Release Notes

- Run migrations in `supabase/migrations/` in order.
- Do not edit already-applied migrations in a shared environment unless the team explicitly agrees to reset/squash.
- Confirm RLS policies and indexes after schema changes.
- Confirm the `no_overlapping_bookings` exclusion constraint remains in place.

## Deployment TODOs

These are not present in the current repository:

- CI workflow.
- Calendar provider webhook/watch renewal handlers.
- Error monitoring.

Document the chosen platform and secrets management before first production deployment.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Security](security.md)
