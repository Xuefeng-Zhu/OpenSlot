-- Provider-portable SQL reference for OpenSlot backend adapters.
--
-- This file is not executed directly by CI. It records the database invariants
-- that any Butterbase or InsForge adapter must preserve
-- when translating schema JSON, migrations, or serverless transaction code.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Confirmed bookings cannot overlap for the same host.
ALTER TABLE bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    host_user_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status = 'confirmed');

-- Active holds and active bookings share one collision ledger.
ALTER TABLE host_reservations
  ADD CONSTRAINT host_reservations_no_overlap
  EXCLUDE USING gist (
    host_user_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status = 'active');

-- MCP API tokens are host-scoped credentials. Providers must store only a
-- one-way token hash plus safe display metadata, never the raw token value.
ALTER TABLE mcp_api_tokens
  ADD CONSTRAINT mcp_api_tokens_allowed_scopes
  CHECK (scopes <@ ARRAY['mcp:read', 'mcp:write']::TEXT[]);

CREATE UNIQUE INDEX ux_mcp_api_tokens_token_hash
  ON mcp_api_tokens(token_hash);

-- Provider adapters must expose equivalent transaction entrypoints:
-- - create-slot-hold
-- - confirm-booking
-- - cancel-booking
-- - reschedule-booking
-- - claim-outbox-events
-- - claim-webhook-deliveries
-- - consume-public-rate-limit
-- - expire-stale-slot-holds
-- - save-availability
--
-- These can be implemented as database functions, edge/serverless functions
-- that run SQL in a transaction, or provider-native atomic operations. REST-only
-- multi-step writes are not an acceptable substitute for these paths.
