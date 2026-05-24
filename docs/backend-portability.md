# Backend Portability

OpenSlot keeps backend providers behind `src/lib/backend/`. Butterbase is now
the active backend runtime, and the same boundary keeps a future InsForge move
from becoming another app-wide rewrite.

## Boundary

- App routes, React components, and domain modules must import provider-neutral
  ports from `@/lib/backend`, never provider SDKs directly.
- Butterbase code belongs under `src/lib/backend/butterbase/`.
- A future InsForge adapter should live under `src/lib/backend/insforge/` and
  implement the same auth, data, function, and transaction ports.
- Atomic booking paths must run through backend function/transaction entrypoints;
  do not rebuild hold, confirm, cancel, reschedule, or worker-claim logic with
  ad hoc browser-visible REST sequences.
- Legacy `src/lib/supabase/*` modules are compatibility shims only. They do not
  import Supabase packages and should disappear as app code moves to
  `@/lib/backend/*` names.

## Provider Contracts

- Canonical table names and ownership hints live in
  `src/lib/backend/types.ts`.
- Stable backend function names live in `src/lib/backend/functions.ts`.
- Shared database migrations live in `backend/database/migrations/`.
- Portable SQL invariants live in `backend/sql/provider-portability.sql`.
- Contract tests live in `src/lib/backend/__tests__/` and provider-specific
  adapter tests live beside their adapters.

## Butterbase Defaults

Butterbase is the first adapter. It expects:

```env
NEXT_PUBLIC_BUTTERBASE_APP_ID=app_openslot
NEXT_PUBLIC_BUTTERBASE_API_URL=https://api.butterbase.ai
BUTTERBASE_API_KEY=...
BUTTERBASE_FUNCTION_SECRET=...
```

`BUTTERBASE_API_KEY` is server-only. It must never be exposed through
`NEXT_PUBLIC_*` variables or sent to browser code.
Browser auth and data calls go through OpenSlot route handlers so Butterbase
tokens remain in HTTP-only cookies. Trusted server-only callers use
`BUTTERBASE_API_KEY` for data service operations and
`BUTTERBASE_FUNCTION_SECRET` for backend function invocation.

## Provider Switch Checklist

Before switching from Butterbase to another backend such as InsForge, the new
adapter must pass the same checklist:

- Dashboard auth: sign up, sign in, refresh, current user, sign out, password
  reset, and dashboard redirect protection.
- Public booking: profile page, event page, slot lookup, hold creation, booking
  confirmation, cancellation, and rescheduling.
- Transaction safety: overlapping holds/bookings fail under concurrent requests,
  stale holds expire, and idempotent retries replay or conflict correctly.
- Workers: outbox and webhook claim functions lease rows without double
  processing.
- Access control: anonymous users cannot read host-private tables, authenticated
  users can only read/write their own host data, and service operations stay
  server-only.
- CI/e2e: tests target OpenSlot routes and UI, not provider-specific URLs, so
  the same suite can run against either adapter.
