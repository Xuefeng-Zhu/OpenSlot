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
```

`NEXT_PUBLIC_APP_URL` is used when generating cancellation and rescheduling links for booking confirmation emails. `OUTBOX_PROCESS_SECRET` and `WEBHOOK_PROCESS_SECRET` protect manual worker POSTs. `CRON_SECRET` protects Vercel Cron GET invocations.

## Worker Triggers

`vercel.json` configures Vercel Cron Jobs for:

- `GET /api/outbox/process`
- `GET /api/webhooks/process`

Vercel sends `CRON_SECRET` as a bearer token when that project environment variable is configured. Non-Vercel deployments should configure an equivalent scheduler that calls the same routes with `Authorization: Bearer <secret>`.

## Database Release Notes

- Run migrations in `supabase/migrations/` in order.
- Do not edit already-applied migrations in a shared environment unless the team explicitly agrees to reset/squash.
- Confirm RLS policies and indexes after schema changes.
- Confirm the `no_overlapping_bookings` exclusion constraint remains in place.

## Deployment TODOs

These are not present in the current repository:

- CI workflow.
- Production email provider.
- Calendar OAuth credentials, callback handling, or provider sync jobs.
- Error monitoring.

Document the chosen platform and secrets management before first production deployment.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Security](security.md)
