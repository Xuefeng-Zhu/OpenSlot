# Release and Deployment

GitHub Actions runs the release gate on pushes to `main` and pull requests
that target `main`. The workflow validates the Next.js app, audits npm
dependencies, starts a local Supabase database, applies all migrations, and
lints the resulting schema.

The repository includes Vercel cron configuration for worker routes, but
production deployment still needs environment variables, Supabase projects,
database migration execution, backups, and rollback ownership configured
outside this repository.

## Release Gate

```bash
npm ci
npm audit --audit-level=moderate
npm run lint
npm run typecheck
npm run test
npm run build
```

The CI database gate also runs:

```bash
supabase db start
supabase db reset --local --no-seed
supabase db lint --local --fail-on error
supabase stop --no-backup
```

For local handoff you can run the same gate with:

```bash
npm run verify
```

`npm run verify` does not run `npm audit` or the Supabase migration gate, so
run those separately for release-sensitive dependency or schema changes.

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

## Environments

Use separate staging and production environments:

- Separate Supabase projects, auth configuration, OAuth callback origins, and
  service-role keys.
- Separate app deploy targets and `NEXT_PUBLIC_APP_URL` values.
- Separate `OUTBOX_PROCESS_SECRET`, `WEBHOOK_PROCESS_SECRET`,
  `CALENDAR_SYNC_SECRET`, `CRON_SECRET`, and calendar token encryption secrets.
- Separate email provider credentials. Use `EMAIL_PROVIDER=console` in staging
  unless a verified test sender is intentionally configured.
- Separate Google and Microsoft OAuth apps or clearly separated redirect URI
  configuration for staging and production origins.

Staging should receive every migration and app release before production.
Production should only use secrets owned by the production operator and stored
in the deployment platform or a secrets manager, not in the repository.

## Required Runtime Configuration

Each deployed environment must provide:

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

Set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY` to send production booking emails through Resend. Set `EMAIL_PROVIDER=maileroo`, `EMAIL_FROM`, and `MAILEROO_API_KEY` to send through Maileroo. Leave `EMAIL_PROVIDER` unset or set to `console` to log emails instead.

## Release Runbook

1. Open a pull request to `main`.
2. Wait for GitHub Actions to pass the app release gate, npm audit, and
   Supabase migration validation.
3. Apply migrations to staging and deploy the app to staging.
4. Smoke test signup/login, dashboard event type loading, public slot lookup,
   hold creation, booking confirmation, cancellation/rescheduling token pages,
   and worker routes.
5. Confirm staging worker routes are being called by the configured scheduler
   and that no outbox, webhook, or calendar sync rows are stuck unexpectedly.
6. Take or confirm a recent production database backup before destructive or
   high-risk migrations.
7. Apply production migrations during the release window.
8. Deploy the production app build that matched the passing CI run.
9. Verify public booking pages, dashboard auth, worker route auth, provider
   sync, and email provider behavior in production.

Prefer backwards-compatible migrations before app deploys. For destructive
changes, use a two-release pattern: add compatible schema first, deploy code
that no longer depends on old fields, then remove old schema in a later
release after backup and monitoring checks.

## Worker Triggers

`vercel.json` configures Vercel Cron Jobs for:

- `GET /api/outbox/process`
- `GET /api/webhooks/process`
- `GET /api/calendar/sync`

Vercel sends `CRON_SECRET` as a bearer token when that project environment variable is configured. Non-Vercel deployments should configure an equivalent scheduler that calls the same routes with `Authorization: Bearer <secret>`.

The deployment owner is responsible for confirming these schedules exist in
the active production platform after every platform migration or project
recreation. The app currently treats Vercel Cron as the canonical scheduler;
do not add another production scheduler without documenting which one owns
each worker route.

## Migration Runbook

- Run migrations in `supabase/migrations/` in order.
- Do not edit already-applied migrations in a shared environment unless the team explicitly agrees to reset/squash.
- Validate migrations locally or in CI with `supabase db start`,
  `supabase db reset --local --no-seed`, and
  `supabase db lint --local --fail-on error`.
- Apply migrations to staging before production.
- Capture command output or deployment logs for each production migration run.
- Review RLS policies, Data API grants, indexes, and exclusion constraints
  after schema changes.
- Confirm the `no_overlapping_bookings` exclusion constraint remains in place.

## Rollback Runbook

Application rollback is a redeploy of the last known-good build using the same
environment variables and Supabase project. Keep previous deployment artifacts
or platform rollback support available for production.

Database rollback is forward-fix first. The repository does not maintain
down-migration files, so a bad migration should normally be repaired with a
new migration that restores compatibility. For destructive migrations or data
loss, restore from the latest Supabase backup or PITR-capable restore into a
new project, validate the restored project, then switch application
configuration or traffic intentionally.

Do not run ad hoc production SQL rollback steps without recording the command,
operator, target project, and follow-up migration needed to bring the
repository back in sync.

## Backup Assumptions

- Production depends on Supabase-managed backups for Postgres durability.
- Choose a Supabase plan with backup retention and PITR that matches the
  product's recovery point objective.
- Confirm backup freshness before destructive migrations and after restoring
  from backup in any incident.
- Practice a staging restore before the first production launch and after
  major schema work.
- Provider secrets, OAuth client credentials, and deploy platform environment
  variables must be recoverable from the team's secrets manager; they are not
  part of database backups.

## Deployment TODOs

These are not present in the current repository:

- Infrastructure-as-code for deploy targets, scheduler ownership, and secrets.
- Calendar provider webhook/watch renewal handlers.
- Error monitoring.

Document the chosen platform and secrets management before first production deployment.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Security](security.md)
