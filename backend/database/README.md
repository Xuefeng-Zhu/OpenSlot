# Shared Database Migrations

This directory contains the shared PostgreSQL schema history for OpenSlot. These
migrations are provider-neutral source material for backend database creation and
schema review.

- `migrations/` records the table, index, constraint, grant, trigger, and
  function history that backend providers must preserve when provisioning a new
  database.
- `seed.sql` is a historical local/demo seed reference. Do not commit secrets or
  production data here.

Butterbase is the active runtime backend. When Butterbase schema or transaction
behavior changes, keep these shared migrations,
`backend/sql/provider-portability.sql`, and the Butterbase function manifest in
`backend/butterbase/functions.json` aligned.
