import { describe, expect, it, vi } from 'vitest'
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  hashRequestPayload,
  resolveIdempotencyKey,
} from '../request-idempotency'

const scope = 'confirm-booking'
const key = 'idem-key-1'
const requestHash = hashRequestPayload({ a: 1, b: 'two' })

function createMockClient({
  insertError = null,
  existing = null,
  selectError = null,
  updateError = null,
}: {
  insertError?: { code?: string; message: string } | null
  existing?: Record<string, unknown> | null
  selectError?: { code?: string; message: string } | null
  updateError?: { code?: string; message: string } | null
}) {
  const calls = {
    insertPayload: null as Record<string, unknown> | null,
    updatePayload: null as Record<string, unknown> | null,
    eqCalls: [] as Array<[string, unknown]>,
  }

  const client = {
    from: vi.fn(() => ({
      insert: async (payload: Record<string, unknown>) => {
        calls.insertPayload = payload
        return { error: insertError }
      },
      select: () => ({
        eq: (column: string, value: unknown) => {
          calls.eqCalls.push([column, value])
          return {
            eq: (nextColumn: string, nextValue: unknown) => {
              calls.eqCalls.push([nextColumn, nextValue])
              return {
                single: async () => ({
                  data: existing,
                  error: selectError,
                }),
              }
            },
          }
        },
      }),
      update: (payload: Record<string, unknown>) => {
        calls.updatePayload = payload
        return {
          eq: (column: string, value: unknown) => {
            calls.eqCalls.push([column, value])
            return {
              eq: (nextColumn: string, nextValue: unknown) => {
                calls.eqCalls.push([nextColumn, nextValue])
                return {
                  eq: async (lastColumn: string, lastValue: unknown) => {
                    calls.eqCalls.push([lastColumn, lastValue])
                    return { error: updateError }
                  },
                }
              },
            }
          },
        }
      },
    })),
  }

  return { client, calls }
}

describe('resolveIdempotencyKey', () => {
  it('accepts matching body and header keys', () => {
    expect(resolveIdempotencyKey('abc-123', 'abc-123')).toEqual({
      ok: true,
      key: 'abc-123',
    })
  })

  it('rejects mismatched body and header keys', () => {
    expect(resolveIdempotencyKey('one', 'two')).toEqual({
      ok: false,
      error: 'Idempotency key body and header values must match',
    })
  })

  it('rejects unsupported characters', () => {
    expect(resolveIdempotencyKey('bad key', null)).toEqual({
      ok: false,
      error: 'Invalid idempotency key',
    })
  })
})

describe('hashRequestPayload', () => {
  it('is stable for object key order differences', () => {
    expect(hashRequestPayload({ b: 2, a: 1 })).toBe(
      hashRequestPayload({ a: 1, b: 2 })
    )
  })
})

describe('beginIdempotentRequest', () => {
  it('starts a new request when the key has not been used', async () => {
    const { client, calls } = createMockClient({})

    const result = await beginIdempotentRequest({
      adminClient: client as any,
      scope,
      key,
      requestHash,
    })

    expect(result).toEqual({
      type: 'started',
      entry: { scope, key, requestHash },
    })
    expect(calls.insertPayload).toMatchObject({
      scope,
      idempotency_key: key,
      request_hash: requestHash,
    })
  })

  it('replays a completed response for the same key and request hash', async () => {
    const { client } = createMockClient({
      insertError: { code: '23505', message: 'duplicate key' },
      existing: {
        scope,
        idempotency_key: key,
        request_hash: requestHash,
        status: 'completed',
        response_json: { success: true, bookingId: 'booking-1' },
        response_status: 201,
      },
    })

    const result = await beginIdempotentRequest({
      adminClient: client as any,
      scope,
      key,
      requestHash,
    })

    expect(result).toEqual({
      type: 'replay',
      response: {
        status: 201,
        body: { success: true, bookingId: 'booking-1' },
      },
    })
  })

  it('returns conflict when the key was used for a different request hash', async () => {
    const { client } = createMockClient({
      insertError: { code: '23505', message: 'duplicate key' },
      existing: {
        scope,
        idempotency_key: key,
        request_hash: 'different',
        status: 'completed',
        response_json: { success: true },
        response_status: 200,
      },
    })

    const result = await beginIdempotentRequest({
      adminClient: client as any,
      scope,
      key,
      requestHash,
    })

    expect(result).toEqual({
      type: 'conflict',
      response: {
        status: 409,
        body: {
          success: false,
          error: 'Idempotency key was already used for a different request',
        },
      },
    })
  })

  it('returns conflict while the matching request is still in progress', async () => {
    const { client } = createMockClient({
      insertError: { code: '23505', message: 'duplicate key' },
      existing: {
        scope,
        idempotency_key: key,
        request_hash: requestHash,
        status: 'in_progress',
        response_json: null,
        response_status: null,
      },
    })

    const result = await beginIdempotentRequest({
      adminClient: client as any,
      scope,
      key,
      requestHash,
    })

    expect(result).toEqual({
      type: 'conflict',
      response: {
        status: 409,
        body: {
          success: false,
          error: 'Request with this idempotency key is still in progress',
        },
      },
    })
  })
})

describe('completeIdempotentRequest', () => {
  it('stores the completed response for replay', async () => {
    const { client, calls } = createMockClient({})

    await completeIdempotentRequest({
      adminClient: client as any,
      entry: { scope, key, requestHash },
      response: {
        status: 200,
        body: { success: true },
      },
    })

    expect(calls.updatePayload).toMatchObject({
      status: 'completed',
      response_json: { success: true },
      response_status: 200,
    })
    expect(calls.eqCalls).toEqual([
      ['scope', scope],
      ['idempotency_key', key],
      ['request_hash', requestHash],
    ])
  })
})
