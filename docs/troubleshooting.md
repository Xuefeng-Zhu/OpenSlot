# Troubleshooting

## Lint Cannot Resolve Next or ESLint Modules

Symptom:

```text
Cannot find module ... eslint-config-next/core-web-vitals
```

Likely cause: stale `node_modules` that does not match `package-lock.json`.

Fix:

```bash
npm ci
npm run lint
```

## Missing Butterbase Environment Variables

The landing page can render without Butterbase, but dashboard, public booking
data, and API routes require `.env.local`.

Check `.env.example` and set:

```env
NEXT_PUBLIC_BUTTERBASE_APP_ID=...
NEXT_PUBLIC_BUTTERBASE_API_URL=https://api.butterbase.ai
BUTTERBASE_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Calendar OAuth Scripts Fail

Run the provider-specific setup scripts from the repo root:

```bash
npm run oauth:google
npm run oauth:microsoft
```

They write to `.env.local` by default. Use `--env-file <path>` or
`ENV_FILE=<path>` when testing against a different env file. Redirect URIs are
derived from `NEXT_PUBLIC_APP_URL`; use `GOOGLE_CALENDAR_REDIRECT_URI` or
`MICROSOFT_CALENDAR_REDIRECT_URI` only when the provider app needs a custom
callback URL.

For Google, install `gcloud` if you want the script to enable the Calendar API automatically. The web OAuth client still has to be created in Google Auth Platform because Google only displays the client secret once in the console flow.

For Microsoft, install Azure CLI and run:

```bash
az login
```

If the Microsoft script fails with an app-registration permission error, the signed-in tenant probably blocks users from creating app registrations. Ask a tenant admin to create the app registration or grant permission, then rerun the script.

## Authenticated Dashboard Redirects to Login

Check:

- Butterbase app id/service key values are valid.
- You have a current Butterbase session.
- A profile exists for the auth user.
- The profile-provisioning route can write to `profiles` for new signups.

## Dashboard Redirects to Onboarding

`/dashboard` redirects to `/onboarding` when the authenticated profile is missing a username. Complete onboarding or update `/profile` with a username. Onboarding persists profile setup, weekly availability, and the first event type through `/api/onboarding`.

## Public Profile or Booking Page 404s

Check:

- `profiles.username` is set.
- The event type exists in Butterbase.
- The event type belongs to the profile.
- `event_types.is_active = true`.
- The slug matches the route segment.

## No Available Slots

Check:

- Host availability rules exist and are active.
- Weekday mapping is correct: database uses `0 = Sunday`.
- Date overrides are not marking the date unavailable.
- Existing confirmed bookings or active holds do not overlap.
- `min_notice_minutes` and `max_booking_days_ahead` are not filtering the slot.
- Timezone values are valid IANA identifiers.

## Booking Fails with Conflict

A `409` usually means another hold or confirmed booking overlaps the requested slot. This is expected concurrency behavior. Refresh slots and choose another time.

## Full Test Suite Prints jsdom Navigation Warning

Symptom:

```text
Not implemented: navigation to another Document
```

This warning is currently non-fatal if Vitest exits with success.

## Shell Cannot Read Files with Parentheses

Quote paths that include App Router route groups:

```bash
sed -n '1,200p' 'src/app/(dashboard)/dashboard/page.tsx'
```

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Architecture](architecture.md)
