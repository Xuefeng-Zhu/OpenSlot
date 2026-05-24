-- Host-scoped API tokens for OpenSlot's MCP server.
-- Raw tokens are shown once on creation and never stored.
CREATE TABLE mcp_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['mcp:read', 'mcp:write'],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mcp_api_tokens_name_length
    CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  CONSTRAINT mcp_api_tokens_prefix_length
    CHECK (char_length(token_prefix) BETWEEN 8 AND 32),
  CONSTRAINT mcp_api_tokens_allowed_scopes
    CHECK (scopes <@ ARRAY['mcp:read', 'mcp:write']::TEXT[]),
  CONSTRAINT mcp_api_tokens_non_empty_scopes
    CHECK (array_length(scopes, 1) > 0)
);

CREATE INDEX idx_mcp_api_tokens_profile
  ON mcp_api_tokens(profile_id, revoked_at, created_at DESC);

CREATE INDEX idx_mcp_api_tokens_active_hash
  ON mcp_api_tokens(token_hash)
  WHERE revoked_at IS NULL;

ALTER TABLE mcp_api_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mcp_api_tokens TO service_role;
REVOKE ALL ON TABLE mcp_api_tokens FROM anon, authenticated;
