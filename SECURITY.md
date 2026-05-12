# Security

OpenSlot handles guest names, emails, notes, timezones, booking times, booking
tokens, OAuth tokens, webhook secrets, and provider credentials. Treat these as
sensitive application data.

## Reporting

This is a private repository. Report security concerns privately to the project
maintainers or through the repository owner instead of opening a public issue.

Include:

- Affected route, API, migration, or integration.
- Steps to reproduce.
- Expected and actual impact.
- Any logs or screenshots with secrets removed.

## Security Rules for Contributors

- Never commit `.env.local`, service role keys, provider credentials, OAuth
  secrets, webhook secrets, or production tokens.
- Never import `src/lib/supabase/admin.ts` into Client Components.
- Keep guest operations authorized by high-entropy hold, cancellation, or
  rescheduling tokens.
- Keep worker routes protected by route-specific secrets or `CRON_SECRET`.
- Preserve RLS policies, explicit grants, and database exclusion constraints
  unless replacing them with equivalent protection.
- Avoid logging guest email, notes, cancellation tokens, rescheduling tokens,
  OAuth tokens, or webhook signing secrets.

See [docs/security.md](docs/security.md) for the full security model and review
checklist.
