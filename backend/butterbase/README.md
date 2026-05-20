# Butterbase Backend Artifacts

Butterbase is the active OpenSlot backend. App runtime code talks to Butterbase
through `src/lib/backend/`; this directory records the provider-owned backend
artifacts that must exist in the configured Butterbase app.

## Runtime Contract

- Data API: OpenSlot uses the Butterbase REST row API under
  `/v1/{app_id}/{table}` for table reads and writes.
- Auth API: OpenSlot uses Butterbase email/password auth endpoints and stores
  access/refresh tokens in HTTP-only app cookies.
- Functions API: OpenSlot invokes HTTP functions at
  `/v1/{app_id}/fn/{function_name}` for atomic booking and worker operations.
- Service key: `BUTTERBASE_API_KEY` stays server-only and maps to the
  provider service role that can bypass RLS.

## Required Functions

The app expects the slugs listed in `functions.json`. These functions must
preserve the transaction semantics documented in
`../sql/provider-portability.sql`, especially:

- hold creation and rescheduling reserve host time atomically;
- booking confirmation and cancellation commit primary booking state before
  app-side outbox/contact work runs;
- worker claim functions lease rows with skip-locked semantics;
- public rate-limit and stale-hold expiry functions remain atomic.

Keep this manifest in sync with `src/lib/backend/functions.ts`.
