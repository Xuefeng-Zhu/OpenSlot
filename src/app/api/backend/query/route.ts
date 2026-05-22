import { NextRequest, NextResponse } from 'next/server'
import { createBackendCompatClient } from '@/lib/backend/compat/query-client'
import { currentBackendAccessToken } from '@/lib/backend/server'

const allowedTables = new Set([
  'profiles',
  'event_types',
  'schedules',
  'availability_rules',
  'availability_overrides',
  'user_settings',
])

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const accessToken = await currentBackendAccessToken()
  if (!accessToken) {
    return NextResponse.json(
      { data: null, error: { message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.table !== 'string' || !allowedTables.has(body.table)) {
    return NextResponse.json(
      { data: null, error: { message: 'Unsupported table' } },
      { status: 400 }
    )
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
      query = query.select(body.selected ?? '*', body.selectOptions ?? {})
      break
    default:
      return NextResponse.json(
        { data: null, error: { message: 'Unsupported operation' } },
        { status: 400 }
      )
  }

  if (body.operation !== 'select' && body.selected) {
    query = query.select(body.selected, body.selectOptions ?? {})
  }

  for (const filter of body.filters ?? []) {
    const applied = applyFilter(query, filter)
    if (!applied.ok) {
      return NextResponse.json(
        { data: null, error: { message: applied.error } },
        { status: 400 }
      )
    }
    query = applied.query
  }

  for (const order of body.orders ?? []) {
    if (typeof order.column === 'string') {
      query = query.order(order.column, { ascending: order.ascending !== false })
    }
  }

  if (Number.isInteger(body.limitCount)) query = query.limit(body.limitCount)
  if (Number.isInteger(body.offsetCount)) query = query.offset(body.offsetCount)
  if (body.responseMode === 'single') query = query.single()
  if (body.responseMode === 'maybeSingle') query = query.maybeSingle()

  const result = await query
  return NextResponse.json(result, {
    status: result.error?.status ?? 200,
  })
}

function applyFilter(
  query: ReturnType<ReturnType<typeof createBackendCompatClient>['from']>,
  filter: { column?: unknown; operator?: unknown; value?: unknown }
) {
  if (typeof filter.column !== 'string' || typeof filter.operator !== 'string') {
    return { ok: false as const, error: 'Malformed filter' }
  }

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
