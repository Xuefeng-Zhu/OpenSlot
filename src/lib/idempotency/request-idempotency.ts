import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '@/lib/types/database'

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/
const DEFAULT_TTL_HOURS = 24

export interface IdempotencyEntry {
  scope: string
  key: string
  requestHash: string
}

export interface CachedIdempotencyResponse {
  body: Json
  status: number
}

export type BeginIdempotencyResult =
  | { type: 'started'; entry: IdempotencyEntry }
  | { type: 'replay'; response: CachedIdempotencyResponse }
  | { type: 'conflict'; response: CachedIdempotencyResponse }
  | { type: 'error'; response: CachedIdempotencyResponse }

type IdempotencyRow = Tables<'request_idempotency'>

/**
 * Resolves the caller's idempotency key from the request body and header.
 * Accepts either source, but rejects malformed values or conflicting duplicates
 * so downstream mutation handlers can use one canonical key.
 */
export function resolveIdempotencyKey(
  bodyKey: string | undefined,
  headerKey: string | null
):
  | { ok: true; key: string | null }
  | { ok: false; error: string } {
  const normalizedBodyKey = normalizeIdempotencyKey(bodyKey)
  const normalizedHeaderKey = normalizeIdempotencyKey(headerKey ?? undefined)

  if (bodyKey !== undefined && !normalizedBodyKey) {
    return { ok: false, error: 'Invalid idempotency key' }
  }

  if (headerKey !== null && !normalizedHeaderKey) {
    return { ok: false, error: 'Invalid Idempotency-Key header' }
  }

  if (
    normalizedBodyKey &&
    normalizedHeaderKey &&
    normalizedBodyKey !== normalizedHeaderKey
  ) {
    return {
      ok: false,
      error: 'Idempotency key body and header values must match',
    }
  }

  return { ok: true, key: normalizedHeaderKey ?? normalizedBodyKey ?? null }
}

/**
 * Hashes a validated request payload into a stable value for idempotency checks.
 * Object keys are canonicalized so semantically identical JSON bodies hash the
 * same even when clients send properties in a different order.
 */
export function hashRequestPayload(payload: unknown): string {
  return createHash('sha256')
    .update(stableStringify(payload))
    .digest('hex')
}

/**
 * Starts an idempotent mutation by inserting a request marker.
 * Returns a replayed response for completed duplicate requests, a conflict for
 * in-flight or payload-mismatched requests, and a marker the caller must complete
 * after producing the mutation response.
 */
export async function beginIdempotentRequest({
  adminClient,
  scope,
  key,
  requestHash,
  ttlHours = DEFAULT_TTL_HOURS,
}: {
  adminClient: SupabaseClient<Database>
  scope: string
  key: string
  requestHash: string
  ttlHours?: number
}): Promise<BeginIdempotencyResult> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    .toISOString()

  const { error: insertError } = await adminClient
    .from('request_idempotency')
    .insert({
      scope,
      idempotency_key: key,
      request_hash: requestHash,
      expires_at: expiresAt,
    })

  if (!insertError) {
    return {
      type: 'started',
      entry: { scope, key, requestHash },
    }
  }

  if (insertError.code !== '23505') {
    console.error('Error starting idempotent request:', insertError)
    return internalIdempotencyError()
  }

  const { data: existing, error: selectError } = await adminClient
    .from('request_idempotency')
    .select('*')
    .eq('scope', scope)
    .eq('idempotency_key', key)
    .single()

  if (selectError || !existing) {
    console.error('Error loading idempotent request:', selectError)
    return internalIdempotencyError()
  }

  return resolveExistingRequest(existing as IdempotencyRow, requestHash)
}

/**
 * Stores the final response for a started idempotent request.
 * This write is best-effort: failures are logged because the primary mutation
 * has already happened, and callers should not roll it back from here.
 */
export async function completeIdempotentRequest({
  adminClient,
  entry,
  response,
}: {
  adminClient: SupabaseClient<Database>
  entry: IdempotencyEntry
  response: CachedIdempotencyResponse
}): Promise<void> {
  const { error } = await adminClient
    .from('request_idempotency')
    .update({
      status: 'completed',
      response_json: response.body,
      response_status: response.status,
      updated_at: new Date().toISOString(),
    })
    .eq('scope', entry.scope)
    .eq('idempotency_key', entry.key)
    .eq('request_hash', entry.requestHash)

  if (error) {
    console.error('Error completing idempotent request:', error)
  }
}

/**
 * Removes an in-progress marker for a request that failed before any mutation
 * happened, allowing the same key to be retried with corrected preflight data.
 */
export async function abandonIdempotentRequest({
  adminClient,
  entry,
}: {
  adminClient: SupabaseClient<Database>
  entry: IdempotencyEntry
}): Promise<void> {
  const { error } = await adminClient
    .from('request_idempotency')
    .delete()
    .eq('scope', entry.scope)
    .eq('idempotency_key', entry.key)
    .eq('request_hash', entry.requestHash)
    .eq('status', 'in_progress')

  if (error) {
    console.error('Error abandoning idempotent request:', error)
  }
}

function normalizeIdempotencyKey(value: string | undefined): string | null {
  if (value === undefined) return null

  const trimmed = value.trim()
  if (
    trimmed.length === 0 ||
    trimmed.length > 128 ||
    !IDEMPOTENCY_KEY_PATTERN.test(trimmed)
  ) {
    return null
  }

  return trimmed
}

function resolveExistingRequest(
  existing: IdempotencyRow,
  requestHash: string
): BeginIdempotencyResult {
  if (existing.request_hash !== requestHash) {
    return {
      type: 'conflict',
      response: {
        status: 409,
        body: {
          success: false,
          error: 'Idempotency key was already used for a different request',
        },
      },
    }
  }

  if (
    existing.status === 'completed' &&
    existing.response_json !== null &&
    existing.response_status !== null
  ) {
    return {
      type: 'replay',
      response: {
        body: existing.response_json,
        status: existing.response_status,
      },
    }
  }

  return {
    type: 'conflict',
    response: {
      status: 409,
      body: {
        success: false,
        error: 'Request with this idempotency key is still in progress',
      },
    },
  }
}

function internalIdempotencyError(): BeginIdempotencyResult {
  return {
    type: 'error',
    response: {
      status: 500,
      body: {
        success: false,
        error: 'Failed to process idempotency key',
      },
    },
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const nested = (value as Record<string, unknown>)[key]
        if (nested !== undefined) {
          acc[key] = canonicalize(nested)
        }
        return acc
      }, {})
  }

  return value
}
