import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createBackendCompatClient } from '@/lib/backend/compat/query-client'
import { currentBackendAccessToken } from '@/lib/backend/server'

const MAX_QUERY_LIMIT = 500
const MAX_QUERY_OFFSET = 10_000

type BrowserQueryOperation =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'upsert'

interface QueryPolicy {
  operations: ReadonlySet<BrowserQueryOperation>
  filters: Readonly<Record<string, ReadonlySet<string>>>
  requiredFilters: readonly string[]
  writableColumns?: ReadonlySet<string>
}

const queryPolicies: Readonly<Record<string, QueryPolicy>> = {
  profiles: {
    operations: new Set(['update']),
    filters: {
      auth_user_id: new Set(['eq']),
    },
    requiredFilters: ['auth_user_id'],
    writableColumns: new Set([
      'name',
      'username',
      'default_timezone',
      'public_headline',
      'public_bio',
      'response_time_label',
      'updated_at',
    ]),
  },
  event_types: {
    operations: new Set(['delete']),
    filters: {
      id: new Set(['eq']),
    },
    requiredFilters: ['id'],
  },
}

const queryFilterSchema = z
  .object({
    column: z.string().min(1).max(128),
    operator: z.string().min(1).max(32),
    value: z.unknown().optional(),
  })
  .strict()

const queryOrderSchema = z
  .object({
    column: z.string().min(1).max(128),
    ascending: z.boolean().default(true),
  })
  .strict()

const queryRequestSchema = z
  .object({
    table: z.string().min(1),
    operation: z.string().min(1),
    payload: z.unknown().optional(),
    upsertOptions: z
      .object({
        onConflict: z.string().min(1).max(256).optional(),
      })
      .strict()
      .optional(),
    selected: z.string().min(1).max(2_000).default('*'),
    selectOptions: z
      .object({
        count: z.enum(['exact']).nullable().optional(),
        head: z.boolean().optional(),
      })
      .strict()
      .default({}),
    filters: z.array(queryFilterSchema).max(50).default([]),
    orders: z.array(queryOrderSchema).max(10).default([]),
    limitCount: z.number().int().min(0).max(MAX_QUERY_LIMIT).optional(),
    offsetCount: z.number().int().min(0).max(MAX_QUERY_OFFSET).optional(),
    responseMode: z.enum(['many', 'single', 'maybeSingle']).default('many'),
  })
  .strict()

type QueryFilter = z.infer<typeof queryFilterSchema>
type QueryRequest = z.infer<typeof queryRequestSchema>
type QueryBuilder = ReturnType<ReturnType<typeof createBackendCompatClient>['from']>

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const accessToken = await currentBackendAccessToken()
    if (!accessToken) {
      return queryErrorResponse('Authentication required', 401)
    }

    const rawBody = await request.json().catch(() => null)
    const parsed = queryRequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      return queryErrorResponse('Invalid query request', 400)
    }

    const body = parsed.data
    const policyResult = validateQueryPolicy(body)
    if (!policyResult.ok) {
      return queryErrorResponse(policyResult.error, 400)
    }

    const client = createBackendCompatClient({ accessToken, authMode: 'user' })
    let query = client.from(body.table)

    switch (body.operation) {
      case 'insert':
        query = query.insert(body.payload)
        break
      case 'update':
        query = query.update(body.payload)
        break
      case 'delete':
        query = query.delete()
        break
      case 'upsert':
        query = query.upsert(body.payload, body.upsertOptions)
        break
      case 'select':
        query = query.select(body.selected, body.selectOptions)
        break
      default:
        return queryErrorResponse('Unsupported operation', 400)
    }

    if (body.operation !== 'select' && body.selected && body.selected !== '*') {
      query = query.select(body.selected, body.selectOptions)
    }

    for (const filter of body.filters) {
      const applied = applyFilter(query, filter)
      if (!applied.ok) {
        return queryErrorResponse(applied.error, 400)
      }
      query = applied.query
    }

    for (const order of body.orders) {
      query = query.order(order.column, { ascending: order.ascending !== false })
    }

    if (body.limitCount !== undefined) query = query.limit(body.limitCount)
    if (body.offsetCount !== undefined) query = query.offset(body.offsetCount)
    if (body.responseMode === 'single') query = query.single()
    if (body.responseMode === 'maybeSingle') query = query.maybeSingle()

    const result = await query
    return NextResponse.json(result, {
      status: result.error?.status ?? 200,
    })
  } catch (error) {
    console.error('Error in POST /api/backend/query:', error)
    return queryErrorResponse('Backend query failed', 500)
  }
}

function validateQueryPolicy(body: QueryRequest) {
  const policy = queryPolicies[body.table]
  if (!policy) {
    return { ok: false as const, error: 'Unsupported table' }
  }

  if (!policy.operations.has(body.operation as BrowserQueryOperation)) {
    return { ok: false as const, error: 'Unsupported operation' }
  }

  if (body.selected !== '*') {
    return {
      ok: false as const,
      error: 'Selecting mutation response columns is not supported',
    }
  }

  if (
    body.orders.length > 0 ||
    body.limitCount !== undefined ||
    body.offsetCount !== undefined
  ) {
    return {
      ok: false as const,
      error: 'Ordering and pagination are not supported for browser mutations',
    }
  }

  if (body.responseMode !== 'many') {
    return {
      ok: false as const,
      error: 'Single-row response modes are not supported for browser mutations',
    }
  }

  for (const requiredColumn of policy.requiredFilters) {
    const hasRequiredFilter = body.filters.some(
      (filter) => filter.column === requiredColumn
    )
    if (!hasRequiredFilter) {
      return {
        ok: false as const,
        error: `Missing required filter: ${requiredColumn}`,
      }
    }
  }

  for (const filter of body.filters) {
    const allowedOperators = policy.filters[filter.column]
    if (!allowedOperators?.has(filter.operator)) {
      return {
        ok: false as const,
        error: `Unsupported filter: ${filter.column}`,
      }
    }
  }

  if (body.operation === 'update') {
    const payloadResult = validatePayloadColumns(body.payload, policy)
    if (!payloadResult.ok) return payloadResult
  }

  return { ok: true as const }
}

function validatePayloadColumns(payload: unknown, policy: QueryPolicy) {
  if (!policy.writableColumns) {
    return { ok: true as const }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false as const, error: 'Invalid mutation payload' }
  }

  for (const column of Object.keys(payload)) {
    if (!policy.writableColumns.has(column)) {
      return {
        ok: false as const,
        error: `Unsupported payload column: ${column}`,
      }
    }
  }

  return { ok: true as const }
}

function applyFilter(query: QueryBuilder, filter: QueryFilter) {
  switch (filter.operator) {
    case 'eq':
      return { ok: true as const, query: query.eq(filter.column, filter.value) }
    case 'gt':
      return { ok: true as const, query: query.gt(filter.column, filter.value) }
    case 'gte':
      return { ok: true as const, query: query.gte(filter.column, filter.value) }
    case 'lt':
      return { ok: true as const, query: query.lt(filter.column, filter.value) }
    case 'lte':
      return { ok: true as const, query: query.lte(filter.column, filter.value) }
    case 'is':
      return { ok: true as const, query: query.is(filter.column, filter.value) }
    case 'in':
      return Array.isArray(filter.value)
        ? { ok: true as const, query: query.in(filter.column, filter.value) }
        : { ok: false as const, error: 'Filter "in" expects an array value' }
    default:
      return {
        ok: false as const,
        error: `Unsupported filter operator: ${filter.operator}`,
      }
  }
}

function queryErrorResponse(message: string, status: number) {
  return NextResponse.json({ data: null, error: { message } }, { status })
}
