# AGENTS.md (backend/)

## OVERVIEW
Database migrations, provider-portable SQL invariants, and Butterbase function/runtime artifacts.

## STRUCTURE
```
backend/
├── database/
│   ├── migrations/     37 SQL files: 11 numeric (001_* to 011_*) + 24 timestamp (YYYYMMDDHHMMSS_*)
│   └── seed.sql        Historical local/demo seed reference (no secrets)
├── sql/
│   └── provider-portability.sql   Shared SQL invariants across providers
└── butterbase/
    ├── functions.json   Function definitions (mirrored in src/lib/backend/functions.ts)
    └── README.md        Butterbase runtime setup reference
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add table or column | `database/migrations/` |
| Modify RLS | `database/migrations/` |
| Update DB function | `database/migrations/` or `butterbase/` |
| Add provider-portable SQL | `sql/provider-portability.sql` |

## MIGRATION CONVENTIONS
- New files use `YYYYMMDDHHMMSS_description.sql` format.
- Idempotent where possible: `IF NOT EXISTS`, `CREATE OR REPLACE`.
- Migration 007 (`create_bookings.sql`): `no_overlapping_bookings` exclusion.
- Migration 008 (`create_rls_policies.sql`): central RLS policy file.
- Migration 009 (`create_indexes.sql`): performance indexes.
- Migration `20260508062648_add_host_reservations.sql`: `host_reservations_no_overlap`.

## KEY INVARIANTS
- `bookings.no_overlapping_bookings` prevents overlapping confirmed bookings per host. Must not be removed.
- `host_reservations_no_overlap` prevents overlapping active holds/bookings per host. Must not be removed.
- RLS enabled on every app table.
- Service-key grants explicit; public pages go through server-side code, never anon table access.
- Guest writes use token auth (`hold_token`, `cancellation_token`), not user sessions.
- Calendar tokens and webhook secrets live in server-only tables. No anon or authenticated grants.
- Calendar OAuth tokens encrypted with `CALENDAR_TOKEN_ENCRYPTION_SECRET` before storage.
- MCP API tokens: store one-way hash plus display metadata only. Never raw values.

## BUTTERBASE FUNCTIONS
- Definitions in `backend/butterbase/functions.json`, mirrored in `src/lib/backend/functions.ts`.
- Keep the two in sync; drift breaks local dev and production parity.
- Key entry points: `create_slot_hold_with_reservation()`, `reschedule_booking_with_hold()`, `anonymize_contact_bookings()`.
- `create_slot_hold_with_reservation()` is the only path for guest holds. Direct `slot_holds` inserts bypass the reservation exclusion constraint.

## ANTI-PATTERNS
- No real credentials or secrets in `seed.sql` or any migration.
- Don't weaken or drop the booking/host_reservation exclusion constraints.
- Don't bypass `create_slot_hold_with_reservation()` for guest holds.
- No anon or authenticated grants on calendar token or webhook secret tables.
- No raw token storage (MCP, OAuth). Use one-way hash plus display metadata.
- Never edit migrations already applied to production. Add a new migration instead.
- Schema changes must update migrations, `provider-portability.sql`, and Butterbase function artifacts together.
