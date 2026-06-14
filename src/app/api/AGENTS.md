# src/app/api/ :: API Route Handlers

## OVERVIEW
Next.js App Router API route handlers: auth, slots, holds, bookings, availability, calendar sync, webhooks, outbox processing, MCP API. All routes use `export const runtime = 'edge'`.

## STRUCTURE
```
src/app/api/
├── auth/              Login, logout, signup, session, password-reset, exchange-code
├── bookings/          POST confirm, PATCH reschedule, GET by id, DELETE cancel
├── holds/             POST create hold (5-min slot hold with reservation)
├── availability/      GET slot lookup, POST batch save
├── slots/             GET public slot computation
├── calendar/          OAuth connect/disconnect, sync trigger (with /oauth/[provider] sub-routes)
├── webhooks/          Endpoint CRUD + delivery process webhook
├── outbox/            Process outbox event queue
├── event-types/       CRUD for host event types
├── contacts/          GET list, GET by id, DELETE anonymize
├── settings/          GET/PATCH user settings
├── onboarding/        GET onboarding state, POST setup
├── notifications/     GET list, PATCH seen
├── booking-agent/     POST booking assistant chat
├── mcp/               MCP API token management, MCP tool endpoints
└── backend/           Backend admin endpoint
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add new endpoint | `src/app/api/<name>/route.ts` |
| Modify auth | `src/app/api/auth/` |
| Confirm booking | `src/app/api/bookings/route.ts` |
| Compute slots | `src/app/api/slots/` |
| Calendar OAuth | `src/app/api/calendar/` |

## CONVENTIONS
- Each route handler exports named HTTP method functions: GET, POST, PATCH, DELETE.
- Route handlers import from `src/lib/` modules. Keep handlers thin: parse, validate, call lib, respond.
- All routes export `export const runtime = 'edge'`. Required for every new route. Node-only APIs will break without it.
- Auth routes use the Butterbase server client. Booking routes use the backend client.
- Public routes (slots, holds) validate that the event type is active and belongs to the host before processing.
- Mutations support optional idempotency via the `Idempotency-Key` header or a request body field.
- The `(dashboard)` layout enforces auth. Individual routes only re-check when they need a specific auth level (admin-only endpoints). NOTE: `src/proxy.ts` is NOT wired up as Next.js middleware. Dashboard layout and per-page redirects handle auth gating.
- Underscore-prefixed non-route files (e.g. `_request.ts`, `_shared.ts`) in route segments are private helpers, not routes.
- Route tests sit in `__tests__/route.test.ts` next to each handler.

## SECURITY
- Service-key writes stay in server-only route handlers.
- Guest-facing routes (holds, bookings) rely on token-based auth (`hold_token`, `cancellation_token`).
- Rate limiting in `src/lib/security/rate-limit.ts` applied in selected mutation routes.
- Never pass `BUTTERBASE_API_KEY` or any other secret to a client response.
- Worker routes (outbox, webhooks, calendar/sync, holds/expire) require route secrets or `CRON_SECRET`.

## ANTI-PATTERNS
- Don't expose `BUTTERBASE_API_KEY` or provider secrets in API responses.
- Don't skip input validation. Use Zod schemas from `src/lib/validations/`.
- Don't call `createAdminBackendClient` inside a Client Component. Only route handlers or server-only modules can use it.
- Don't return raw database errors to the client. Catch and map to structured error responses.
- Don't add auth checks to every route if the layout already covers it. Add only when a specific elevated permission is needed.
- Don't add a new API route without `export const runtime = 'edge'`.
