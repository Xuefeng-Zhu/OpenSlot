# Development

## Prerequisites

- Node.js 22 LTS or newer is recommended. The current toolchain requires
  Node.js 20.19 or newer.
- npm. Use the npm version recorded in `package.json` when possible.
- Butterbase app id and service API key for backend-backed local development.

## Install

Use the lockfile:

```bash
npm ci
```

If `node_modules` is stale, lint/build can fail with misleading module resolution errors. Re-run `npm ci`.

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Minimum app variables:

```env
NEXT_PUBLIC_BUTTERBASE_APP_ID=app_...
NEXT_PUBLIC_BUTTERBASE_API_URL=https://api.butterbase.ai
BUTTERBASE_API_KEY=bb_sk_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Keep `BUTTERBASE_API_KEY` server-only. It is used by server route handlers and
the Butterbase adapter under `src/lib/backend/butterbase/`.
Butterbase function invocations use the server-only `BUTTERBASE_API_KEY` and
the provider-verified `service_key` caller identity. A separate function
bearer secret is no longer required.
Set `SLOT_HOLD_TOKEN_SECRET` only when you want a dedicated HMAC secret for
short-lived public slot hold tokens; omit it when you want signing to fall
back to a legacy `BUTTERBASE_FUNCTION_SECRET`, then a domain-separated key
derived from `BUTTERBASE_API_KEY`.

Worker routes can run without secrets outside production. Set
`OUTBOX_PROCESS_SECRET`, `WEBHOOK_PROCESS_SECRET`,
`CALENDAR_SYNC_SECRET`, `HOLD_EXPIRY_PROCESS_SECRET`, or `CRON_SECRET` when
testing bearer-token protection locally or deploying.

Public booking mutation routes enforce Cloudflare Turnstile only when both
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are configured.
Leave them unset for normal local development.

Calendar integration development also needs provider OAuth credentials and
`CALENDAR_TOKEN_ENCRYPTION_SECRET`. `MICROSOFT_CALENDAR_TENANT` defaults to
`common`.

Calendar watch callbacks use `NEXT_PUBLIC_APP_URL` to register
`/api/calendar/webhooks/google` and `/api/calendar/webhooks/microsoft` with the
providers. Production provider apps must use an HTTPS app URL. Set
`CALENDAR_FINAL_AVAILABILITY_CHECK=stale` to live-check provider free/busy
before booking confirmation whenever cache or watch health is stale; leave it
unset or set to `off` to disable that final check. Use
`CALENDAR_STALE_AFTER_MINUTES` to tune the stale-cache window; the app defaults
to 10 minutes.

To configure calendar OAuth credentials locally:

```bash
npm run oauth:calendar
```

Provider-specific scripts are also available:

```bash
npm run oauth:google
npm run oauth:microsoft
```

The OAuth setup scripts write to `.env.local` by default. Use
`--env-file <path>` or `ENV_FILE=<path>` to target a different env file. The
scripts derive redirect URIs from `NEXT_PUBLIC_APP_URL`; override them with
`GOOGLE_CALENDAR_REDIRECT_URI` or `MICROSOFT_CALENDAR_REDIRECT_URI` only when
the provider app needs a non-default callback. The Google helper also accepts
`GOOGLE_CALENDAR_JS_ORIGIN` and `GOOGLE_CLOUD_PROJECT` or `GCLOUD_PROJECT`.
`npm run oauth:calendar` runs both providers by default; use
`npm run oauth:calendar -- --google` or
`npm run oauth:calendar -- --microsoft` to configure only one provider.

The Google script enables the Calendar API when `gcloud` is installed, opens the Google Auth Platform client page, then securely prompts for the one-time client ID and secret. Google does not expose a general CLI/API flow for creating Calendar-capable web OAuth clients, so the client creation step remains a console action.

The Microsoft script uses Azure CLI to create a fresh Entra app registration, configure the OpenSlot redirect URI, add delegated Microsoft Graph `User.Read` and `Calendars.ReadWrite` permissions, create a client secret, and write the resulting values to `.env.local`. Install Azure CLI and run `az login` before using it.

Email delivery defaults to the console provider. To exercise real email sends locally, set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY`, or set `EMAIL_PROVIDER=maileroo`, `EMAIL_FROM`, and `MAILEROO_API_KEY`.

The public booking assistant uses the Butterbase model gateway from server-side
route handlers. It is visible only when the app has `BUTTERBASE_API_KEY`
configured. It sends `deepseek/deepseek-v4-flash` by default; set
`BOOKING_AGENT_MODEL` only when a deployment needs a different allowed model in
the Butterbase AI configuration.

## Backend Schema

Butterbase is the active backend. Keep shared database migrations in
`backend/database/migrations/`, provider-neutral invariants in
`backend/sql/provider-portability.sql`, and Butterbase-specific function/runtime
artifacts under `backend/butterbase/`. New backend runtime work should not add
Supabase-only code paths.

## App Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run verify
```

`npm run verify` runs lint, typecheck, tests, and the production build. Use the
individual commands while iterating and the combined command before handoff.

## Coding Patterns

- Use Server Components for initial authenticated data loads.
- Use Client Components for interactivity and local form state.
- Route handlers should validate inputs with Zod before writing.
- Keep service-key access inside server-only code.
- Use `@/*` imports instead of long relative paths.
- Use `Button`, `Card`, `Input`, `Label`, and other primitives from `src/components/ui/`.
- Use `lucide-react` icons when adding icon UI.
- Keep timezone-sensitive logic in or near `src/lib/availability/` and test it.

## Adding a Feature

1. Identify whether the target surface is live or prototype/mock.
2. Add/extend validation schema in `src/lib/validations/` if new input crosses a boundary.
3. Keep persistence in Server Components, API routes, or server-only libraries.
4. Add tests near the changed behavior.
5. Update docs if behavior, setup, commands, or architecture changed.

## Shell Tips

Quote paths with route groups or dynamic segments:

```bash
sed -n '1,220p' 'src/app/(dashboard)/dashboard/page.tsx'
npm run test -- 'src/app/(dashboard)/__tests__/dashboard-booking-link.property.test.ts'
```

## Related Docs

- [Repository Structure](repository-structure.md)
- [Testing](testing.md)
- [Troubleshooting](troubleshooting.md)
- [Agent Workflow](agent-workflow.md)
