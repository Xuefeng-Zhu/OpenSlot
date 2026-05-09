# Development

## Prerequisites

- Node.js 20.9 or newer.
- npm.
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

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=...
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is used by `src/lib/supabase/admin.ts`.

Calendar integration development also needs provider OAuth credentials and `CALENDAR_TOKEN_ENCRYPTION_SECRET`. `CALENDAR_SYNC_SECRET` is optional locally unless you want route-specific protection on `/api/calendar/sync`; otherwise `CRON_SECRET` can protect the cron GET path.

To configure calendar OAuth credentials locally:

```bash
npm run oauth:calendar
```

Provider-specific scripts are also available:

```bash
npm run oauth:google
npm run oauth:microsoft
```

The Google script enables the Calendar API when `gcloud` is installed, opens the Google Auth Platform client page, then securely prompts for the one-time client ID and secret. Google does not expose a general CLI/API flow for creating Calendar-capable web OAuth clients, so the client creation step remains a console action.

The Microsoft script uses Azure CLI to create a fresh Entra app registration, configure the OpenSlot redirect URI, add delegated Microsoft Graph `User.Read` and `Calendars.ReadWrite` permissions, create a client secret, and write the resulting values to `.env.local`. Install Azure CLI and run `az login` before using it.

Email delivery defaults to the console provider. To exercise real email sends locally, set `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY`, or set `EMAIL_PROVIDER=maileroo`, `EMAIL_FROM`, and `MAILEROO_API_KEY`.

## Local Database

With Supabase CLI:

```bash
supabase start
supabase db push
supabase db seed
```

For a clean local reset:

```bash
supabase db reset
```

Migrations are ordered SQL files in `supabase/migrations/`. Add new migrations for schema changes.

## App Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

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

- [Testing](testing.md)
- [Troubleshooting](troubleshooting.md)
- [Agent Workflow](agent-workflow.md)
