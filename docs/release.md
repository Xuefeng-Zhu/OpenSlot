# Release and Deployment

GitHub Actions runs the release gate on pushes to `main` and pull requests
that target `main`. The workflow validates the Next.js app, audits npm
dependencies, and builds the app against Butterbase-shaped runtime
configuration. The optional Dashboard E2E job runs against a configured
Butterbase test app when repository secrets are present.

The repository includes Vercel cron configuration for worker routes, but
production deployment still needs environment variables, Butterbase apps,
Butterbase schema/function deployment, backups, and rollback ownership configured
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

For local handoff you can run the same gate with:

```bash
npm run verify
```

`npm run verify` does not run `npm audit` or provider schema deployment
checks, so run those separately for release-sensitive dependency or backend
schema/function changes.

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

- Separate Butterbase apps, auth configuration, OAuth callback origins, and
  service keys.
- Separate app deploy targets and `NEXT_PUBLIC_APP_URL` values.
- Separate `OUTBOX_PROCESS_SECRET`, `WEBHOOK_PROCESS_SECRET`,
  `CALENDAR_SYNC_SECRET`, `HOLD_EXPIRY_PROCESS_SECRET`, `CRON_SECRET`,
  function, slot-token, and calendar token encryption secrets.
- Separate email provider credentials. Use `EMAIL_PROVIDER=console` in staging
  unless a verified test sender is intentionally configured.
- Separate Google and Microsoft OAuth apps or clearly separated redirect URI
  configuration for staging and production origins.

Staging should receive every migration and app release before production.
Production should only use secrets owned by the production operator and stored
in the deployment platform or a secrets manager, not in the repository.

## Required Runtime Configuration

Each deployed environment should provide the app, backend, worker, and
enabled-integration values it uses:

```env
NEXT_PUBLIC_BUTTERBASE_APP_ID=...
NEXT_PUBLIC_BUTTERBASE_API_URL=https://api.butterbase.ai
BUTTERBASE_API_KEY=...
BUTTERBASE_FUNCTION_SECRET=...
# Optional but recommended dedicated token signing secret.
SLOT_HOLD_TOKEN_SECRET=...
NEXT_PUBLIC_APP_URL=https://your-production-origin.example
OUTBOX_PROCESS_SECRET=...
WEBHOOK_PROCESS_SECRET=...
CRON_SECRET=...
HOLD_EXPIRY_PROCESS_SECRET=...
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
MICROSOFT_CALENDAR_CLIENT_ID=...
MICROSOFT_CALENDAR_CLIENT_SECRET=...
MICROSOFT_CALENDAR_TENANT=common
CALENDAR_TOKEN_ENCRYPTION_SECRET=...
CALENDAR_SYNC_SECRET=...
CALENDAR_FINAL_AVAILABILITY_CHECK=stale
CALENDAR_STALE_AFTER_MINUTES=10
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
BOOKING_AGENT_MODEL=deepseek/deepseek-v4-flash
EMAIL_PROVIDER=console
EMAIL_FROM="OpenSlot <bookings@example.com>"
RESEND_API_KEY=...
MAILEROO_API_KEY=...
```

`NEXT_PUBLIC_APP_URL` is used when generating cancellation, rescheduling, and OAuth callback URLs. `BUTTERBASE_FUNCTION_SECRET` authorizes Butterbase function calls. `SLOT_HOLD_TOKEN_SECRET` signs short-lived public slot hold tokens; if it is unset, signing falls back to `BUTTERBASE_FUNCTION_SECRET`, then `BUTTERBASE_API_KEY`. `OUTBOX_PROCESS_SECRET`, `WEBHOOK_PROCESS_SECRET`, `CALENDAR_SYNC_SECRET`, and `HOLD_EXPIRY_PROCESS_SECRET` protect manual worker POSTs. `CRON_SECRET` protects Vercel Cron GET invocations.

Set both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to enforce
Cloudflare Turnstile on public booking mutations. Leave them unset for local
development or deployments that intentionally skip bot protection.

`CALENDAR_TOKEN_ENCRYPTION_SECRET` encrypts stored per-user OAuth access and refresh tokens before persistence. Use a high-entropy server-only value and keep it stable across deploys.

Calendar watch callbacks are registered from `NEXT_PUBLIC_APP_URL`; production
Google/Microsoft apps must point to the HTTPS `/api/calendar/webhooks/google`
and `/api/calendar/webhooks/microsoft` routes. Set
`CALENDAR_FINAL_AVAILABILITY_CHECK=stale` when production booking confirmation
should fail closed and live-check provider free/busy if calendar cache or watch
health is stale.

Generated Google Meet and Microsoft Teams links depend on the existing Google/Microsoft calendar OAuth credentials and writable provider calendars. No separate Zoom or video-provider secret is required for the v1 video integration.

The public booking assistant is enabled when `BUTTERBASE_API_KEY` is present and
uses the Butterbase AI gateway with `deepseek/deepseek-v4-flash` by default.
Ensure the Butterbase app AI configuration allows that model before enabling it
in production. Set `BOOKING_AGENT_MODEL` only to make an intentional deployment
override.

Set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY` to send production booking and reminder emails through Resend. Set `EMAIL_PROVIDER=maileroo`, `EMAIL_FROM`, and `MAILEROO_API_KEY` to send through Maileroo. Leave `EMAIL_PROVIDER` unset or set to `console` to log emails instead.

## Release Runbook

1. Open a pull request to `main`.
2. Wait for GitHub Actions to pass the app release gate, npm audit, and the
   Butterbase-backed Dashboard E2E job when configured.
3. Apply Butterbase schema/function updates to staging and deploy the app to staging.
4. Smoke test signup/login, dashboard event type loading, public slot lookup,
   hold creation, booking confirmation, cancellation/rescheduling token pages,
   and worker routes.
5. Confirm staging worker routes are being called by the configured scheduler
   and that no outbox, webhook, or calendar sync rows are stuck unexpectedly.
6. Take or confirm a recent production database backup before destructive or
   high-risk migrations.
7. Apply production Butterbase schema/function updates during the release window.
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
- `GET /api/holds/expire`

The committed schedules run once daily so Hobby preview deployments pass
Vercel's Cron limits. Production deployments that need lower-latency
notifications, reminders, webhook delivery, calendar busy-cache refreshes, or
calendar watch renewal should use a
Vercel plan or an external scheduler that supports the desired cadence. Vercel
sends `CRON_SECRET` as a bearer token when that project environment variable is
configured. Non-Vercel deployments should configure an equivalent scheduler that
calls the same routes with `Authorization: Bearer <secret>`.

The committed hold-expiry schedule is daily for compatibility with the rest of
the Vercel cron config. Production deployments should call `/api/holds/expire`
every 1-5 minutes when scheduler limits allow it so stale holds release promptly.

The outbox worker must run for generated conference links and booking notification emails to complete. Video-provider bookings remain confirmed while conference link creation is pending or retrying.

The deployment owner is responsible for confirming these schedules exist in
the active production platform after every platform migration or project
recreation. The app currently treats Vercel Cron as the canonical scheduler;
do not add another production scheduler without documenting which one owns
each worker route.

Reminder punctuality depends on how often `/api/outbox/process` runs. The
worker only sends rows whose `available_at` is due, then rechecks the booking
status and scheduled start/end time before emailing, so stale reminders from
cancelled or rescheduled bookings complete without sending mail.

## Backend Schema Runbook

- Keep `backend/sql/provider-portability.sql` aligned with table constraints,
  RLS expectations, and atomic transaction entrypoints.
- Apply provider-owned Butterbase schema/function artifacts to staging before
  production.
- Do not mutate shared production schema directly unless the change is captured
  in repository artifacts and reviewed.
- Capture command output or deployment logs for each production schema/function
  update.
- Review RLS policies, Data API grants, indexes, exclusion constraints, and
  deployed Butterbase functions after schema changes.
- Confirm the `no_overlapping_bookings` exclusion constraint remains in place.

## Rollback Runbook

Application rollback is a redeploy of the last known-good build using the same
environment variables and Butterbase app. Keep previous deployment artifacts
or platform rollback support available for production.

Database rollback is forward-fix first. The repository does not maintain
down-migration files, so a bad migration should normally be repaired with a
new migration that restores compatibility. For destructive migrations or data
loss, restore from the latest Butterbase/Postgres backup or PITR-capable
restore into a new app, validate the restored app, then switch application
configuration or traffic intentionally.

Do not run ad hoc production SQL rollback steps without recording the command,
operator, target project, and follow-up migration needed to bring the
repository back in sync.

## Backup Assumptions

- Production depends on provider-managed Postgres backups for durability.
- Choose a Butterbase plan with backup retention and PITR that matches the
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
- Error monitoring.

Document the chosen platform and secrets management before first production deployment.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Security](security.md)
