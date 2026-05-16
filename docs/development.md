# Development

## Prerequisites

- Node.js 22 LTS or newer is recommended. The current toolchain requires
  Node.js 20.19 or newer.
- npm. Use the npm version recorded in `package.json` when possible.
- Supabase project or Supabase CLI for local development.

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
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is used by `src/lib/supabase/admin.ts`.

Worker routes can run without secrets outside production. Set
`OUTBOX_PROCESS_SECRET`, `WEBHOOK_PROCESS_SECRET`, `CALENDAR_SYNC_SECRET`, or
`CRON_SECRET` when testing bearer-token protection locally or deploying.

Calendar integration development also needs provider OAuth credentials and
`CALENDAR_TOKEN_ENCRYPTION_SECRET`. `MICROSOFT_CALENDAR_TENANT` defaults to
`common`.

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

The Google script enables the Calendar API when `gcloud` is installed, opens the Google Auth Platform client page, then securely prompts for the one-time client ID and secret. Google does not expose a general CLI/API flow for creating Calendar-capable web OAuth clients, so the client creation step remains a console action.

The Microsoft script uses Azure CLI to create a fresh Entra app registration, configure the OpenSlot redirect URI, add delegated Microsoft Graph `User.Read` and `Calendars.ReadWrite` permissions, create a client secret, and write the resulting values to `.env.local`. Install Azure CLI and run `az login` before using it.

Email delivery defaults to the console provider. To exercise real email sends locally, set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY`, or set `EMAIL_PROVIDER=maileroo`, `EMAIL_FROM`, and `MAILEROO_API_KEY`.

## Local Database

With Supabase CLI:

```bash
supabase start
supabase db reset --local
```

`supabase db reset --local` applies all migrations and then loads
`supabase/seed.sql` because `[db.seed]` is enabled in `supabase/config.toml`.
Use a migration-only reset when you do not want seed data:

```bash
supabase db reset --local --no-seed
```

To apply pending migrations to an already-running local database without
resetting data:

```bash
supabase db push --local
```

For a linked remote project, review the pending migration list before applying
it:

```bash
supabase db push --linked --dry-run
supabase db push --linked
```

Migrations are ordered SQL files in `supabase/migrations/`. Add new migrations for schema changes.

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
- Keep service role access inside server-only code.
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
