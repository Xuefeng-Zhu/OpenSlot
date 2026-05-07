# Release and Build Notes

There is no committed deployment platform config or GitHub Actions workflow in this repository. Use the local validation gate below before shipping.

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
```

`NEXT_PUBLIC_APP_URL` is used when generating cancellation links for booking confirmation emails.

## Database Release Notes

- Run migrations in `supabase/migrations/` in order.
- Do not edit already-applied migrations in a shared environment unless the team explicitly agrees to reset/squash.
- Confirm RLS policies and indexes after schema changes.
- Confirm the `no_overlapping_bookings` exclusion constraint remains in place.

## Deployment TODOs

These are not present in the current repository:

- CI workflow.
- Deployment platform config.
- Production email provider.
- Calendar integration credentials or setup.
- Error monitoring.

Document the chosen platform and secrets management before first production deployment.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Security](security.md)
