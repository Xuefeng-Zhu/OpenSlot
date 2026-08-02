# MCP

OpenSlot exposes a host-scoped Model Context Protocol server at:

```text
POST /api/mcp
```

The endpoint is stateless Streamable HTTP with JSON responses. It supports
`initialize`, `notifications/initialized`, `ping`, `tools/list`, and
`tools/call`. SSE sessions, resumability, OAuth dynamic client registration,
and external Cal.com or Calendly MCP connectors are out of scope for v1.

## Authentication

Hosts create MCP API tokens from Settings -> Integrations -> MCP API tokens.
Raw tokens use the `os_mcp_` prefix and are shown once. OpenSlot stores only a
hash, a short display prefix, scopes, and timestamp metadata.

Send the token as a Bearer credential:

```http
Authorization: Bearer os_mcp_...
Content-Type: application/json
```

Read tools require `mcp:read`; mutation tools require `mcp:write`. Tokens can be
revoked from Settings.

## Client Configuration

For MCP clients that accept remote Streamable HTTP servers, configure:

```json
{
  "mcpServers": {
    "openslot": {
      "url": "https://your-openslot-host.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer os_mcp_your-token"
      }
    }
  }
}
```

For local development:

```json
{
  "mcpServers": {
    "openslot-local": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer os_mcp_your-token"
      }
    }
  }
}
```

## Tools

V1 exposes:

- `openslot_get_profile`
- `openslot_list_event_types`
- `openslot_get_event_type`
- `openslot_list_available_slots`
- `openslot_list_bookings`
- `openslot_create_booking_hold`
- `openslot_confirm_booking`
- `openslot_cancel_booking`
- `openslot_reschedule_booking`

Read tools scope all data to the token owner. Booking list responses omit
cancellation and reschedule tokens. Cancel and reschedule tools accept a
`bookingId`; the server loads the required booking token only after confirming
that the booking belongs to the authenticated host.

## Booking Writes

MCP booking writes are host-authorized and therefore do not require browser
Turnstile tokens. They still reuse the existing booking integrity paths:

- available-slot computation and hold validation
- `create_slot_hold_with_reservation()`
- booking confirmation, cancellation, and rescheduling engines
- request idempotency
- DB-backed rate limits
- host reservation collision constraints
- booking audit events, contact updates, and outbox side effects

Use `idempotencyKey` on mutation tools when a client may retry a request.

## Example Tool Call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "openslot_list_available_slots",
    "arguments": {
      "eventTypeId": "11111111-1111-4111-8111-111111111111",
      "startDate": "2026-06-01",
      "endDate": "2026-06-07",
      "timezone": "America/Los_Angeles"
    }
  }
}
```

Responses include both text content and `structuredContent` so clients can
render a short summary or consume typed data.

## Operational Notes

- Apply `backend/database/migrations/20260524000000_add_mcp_api_tokens.sql`
  before enabling tokens in production.
- Token creation and revocation stay disabled until Settings loads the complete
  token list. A failed load returns safe retry guidance without database details.
- Keep MCP tokens out of source control and local issue logs.
- Revoke and recreate tokens after exposing a client config, device, or backup.
- Prefer HTTPS for remote MCP clients.
