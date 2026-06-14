# src/lib/ :: Core Business Logic

## OVERVIEW

Core business logic library: slot computation, booking engine, calendar sync, validation schemas, backend adapter, outbox/event processing.

## STRUCTURE

```
src/lib/
├── availability/     Slot computation engine (rules, overrides, buffers)
├── booking/          Booking lifecycle (confirm, cancel, reschedule, events)
├── calendar/         Provider OAuth, sync, busy cache, event CRUD
├── validations/      Zod schemas
├── backend/          Provider-neutral ports + Butterbase adapter + compat clients
├── outbox/           Side-effect event queue (enqueue + process)
├── webhooks/         Tenant webhook endpoints + deliveries
├── contacts/         Guest identity normalization, summaries, anonymization
├── idempotency/      Retry-safe mutation helpers
├── reservations/     Host reservation mirror helpers
├── email/            Template composition, provider selection
├── security/         Rate limiting, token encryption
├── utils/            Slug, timezone, cn() helpers
├── booking-agent/    Public booking assistant LLM agent
├── workers/          Worker utilities
├── dashboard/        Dashboard prototype data helpers
├── mcp/              MCP server utilities
├── auth/             Auth helpers
├── types/            Shared TypeScript types
└── http/             HTTP utilities
```

## WHERE TO LOOK

| Task | Location |
| --- | --- |
| Compute bookable slots, apply rules/overrides/buffers | `availability/` |
| Confirm, cancel, or reschedule a booking; emit lifecycle events | `booking/` |
| Validate request bodies, query params, or form payloads | `validations/` |
| Talk to DB or auth (RSC, server actions, workers) | `backend/butterbase/` |
| Need a cross-cutting port trait or DTO contract | `backend/backend.ts` |
| Reach for a legacy `supabase` / `createClient` helper | `backend/compat/` |
| Enqueue or process side-effect events | `outbox/` |
| Sign, verify, or deliver tenant webhooks | `webhooks/` |
| Normalize guest identity, build contact summaries | `contacts/` |
| Make a mutation retry-safe under network failure | `idempotency/` |
| Mirror a booking to host's external reservation store | `reservations/` |
| Render an email or pick a delivery provider | `email/` |
| Rate limit, encrypt tokens, or guard an endpoint | `security/` |
| Slug, timezone math, class-name join, misc helpers | `utils/` |
| Public booking assistant (LLM agent) | `booking-agent/` |
| Background worker entry points and queue consumers | `workers/` |
| Dashboard prototype fixtures and mock data | `dashboard/` |
| MCP server tools and request handling | `mcp/` |
| Session, role, or current-user helpers | `auth/` |
| Shared TypeScript types reused across modules | `types/` |
| Outbound HTTP, fetch wrappers, retries | `http/` |

## CONVENTIONS

- Pure functions preferred; side effects explicit at the caller site.
- Booking and availability engines are stateless pure modules. No class instances, no module-level mutable state.
- Backend port types live in `backend.ts`; the Butterbase adapter in `backend/butterbase/`; legacy Supabase/Clerk shims in `backend/compat/`.
- Validation schemas live in `src/lib/validations/`, one file per domain (booking, slot, contact, etc.).
- Use the `@/` import alias. Avoid relative imports that climb more than two levels.
- JSDoc on every exported function in this tree (strict rule inherited from parent).
- Contact sync, idempotency writes, and reservation mirrors are best-effort. Never let them fail the primary operation; log and swallow at the seam.

## ANTI-PATTERNS

- Never import `createAdminBackendClient` into a Client Component. It bypasses RLS and will leak across tenants.
- Never bypass `create_slot_hold_with_reservation()` for guest holds. It owns the atomic hold + reservation-mirror transaction.
- Never store raw tokens in the database. Encrypt MCP tokens and OAuth tokens via `security/` before persisting.
- Never include PII (guest names, emails, cancellation tokens) in outbox payloads. Outbox rows are tenant-visible in admin tooling.
- Never import `next/navigation` or `next/headers` from a pure lib module. Those are request-scoped; lib code stays framework-agnostic.
