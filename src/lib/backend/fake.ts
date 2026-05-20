import { randomUUID } from 'node:crypto'
import type { BackendPorts, BackendFunctionName } from './ports'
import {
  backendFailure,
  backendSuccess,
  type BackendFilterValue,
  type BackendFunctionRequest,
  type BackendListOptions,
  type BackendResult,
} from './ports'
import type {
  BackendInsert,
  BackendRow,
  BackendTable,
  BackendUpdate,
} from './types'

type RowStore = Map<string, Record<string, unknown>>
type FunctionHandler = (
  request: BackendFunctionRequest<unknown>
) => Promise<unknown> | unknown

export interface FakeBackendOptions {
  functions?: Partial<Record<BackendFunctionName, FunctionHandler>>
}

export interface FakeBackend extends BackendPorts {
  seed<TTable extends BackendTable>(
    table: TTable,
    rows: Array<BackendRow<TTable>>
  ): void
  functionCalls: Array<{
    name: BackendFunctionName
    request: BackendFunctionRequest<unknown>
  }>
}

export function createFakeBackend(options: FakeBackendOptions = {}): FakeBackend {
  const tables = new Map<BackendTable, RowStore>()
  const functionCalls: FakeBackend['functionCalls'] = []
  let currentUser: { id: string; email: string | null } | null = null

  function tableStore(table: BackendTable): RowStore {
    const existing = tables.get(table)
    if (existing) return existing

    const created: RowStore = new Map()
    tables.set(table, created)
    return created
  }

  const backend: FakeBackend = {
    provider: 'fake',
    functionCalls,
    seed(table, rows) {
      const store = tableStore(table)
      rows.forEach((row) => {
        store.set(String((row as { id?: string }).id ?? randomUUID()), {
          ...row,
        })
      })
    },
    auth: {
      async getCurrentUser() {
        return currentUser
          ? backendSuccess(currentUser)
          : backendFailure({ message: 'Unauthorized', status: 401 })
      },
      async signInWithPassword(input) {
        currentUser = { id: 'fake-user-id', email: input.email }
        return backendSuccess({
          accessToken: 'fake-access-token',
          refreshToken: 'fake-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          user: currentUser,
        })
      },
      async signUp(input) {
        currentUser = { id: 'fake-user-id', email: input.email }
        return backendSuccess({
          ...currentUser,
          displayName: input.displayName,
        })
      },
      async refreshSession() {
        if (!currentUser) {
          return backendFailure({ message: 'Unauthorized', status: 401 })
        }

        return backendSuccess({
          accessToken: 'fake-refreshed-access-token',
          refreshToken: 'fake-refreshed-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          user: currentUser,
        })
      },
      async signOut() {
        currentUser = null
        return backendSuccess({ success: true })
      },
      async requestPasswordReset() {
        return backendSuccess({ success: true })
      },
      async resetPassword() {
        return backendSuccess({ success: true })
      },
    },
    data: {
      async list(table, listOptions = {}) {
        const rows = Array.from(tableStore(table).values()).filter((row) =>
          matchesFilters(row, listOptions)
        )

        return backendSuccess(rows as Array<BackendRow<typeof table>>)
      },
      async getById(table, id) {
        const row = tableStore(table).get(id)
        return row
          ? backendSuccess(row as BackendRow<typeof table>)
          : backendFailure({ message: 'Row not found', status: 404 })
      },
      async insert(table, row) {
        const id = String((row as { id?: string }).id ?? randomUUID())
        const created = { ...row, id }
        tableStore(table).set(id, created)

        return backendSuccess(created as BackendRow<typeof table>)
      },
      async update(table, id, patch) {
        const store = tableStore(table)
        const existing = store.get(id)

        if (!existing) {
          return backendFailure({ message: 'Row not found', status: 404 })
        }

        const updated = { ...existing, ...patch }
        store.set(id, updated)
        return backendSuccess(updated as BackendRow<typeof table>)
      },
      async remove(table, id) {
        tableStore(table).delete(id)
        return backendSuccess({ success: true })
      },
    },
    functions: {
      async invoke(name, request = {}) {
        functionCalls.push({
          name,
          request: request as BackendFunctionRequest<unknown>,
        })
        const handler = options.functions?.[name]

        if (!handler) {
          return backendFailure({
            message: `No fake function handler registered for ${name}`,
            status: 404,
          })
        }

        const data = await handler(request as BackendFunctionRequest<unknown>)
        return backendSuccess(data as never)
      },
    },
    transactions: {
      createSlotHold(input) {
        return backend.functions.invoke('createSlotHold', { body: input })
      },
      confirmBooking(input) {
        return backend.functions.invoke('confirmBooking', { body: input })
      },
      cancelBooking(input) {
        return backend.functions.invoke('cancelBooking', { body: input })
      },
      rescheduleBooking(input) {
        return backend.functions.invoke('rescheduleBooking', { body: input })
      },
      claimOutboxEvents(input = {}) {
        return backend.functions.invoke('claimOutboxEvents', { body: input })
      },
      claimWebhookDeliveries(input = {}) {
        return backend.functions.invoke('claimWebhookDeliveries', { body: input })
      },
      consumePublicRateLimit(input) {
        return backend.functions.invoke('consumePublicRateLimit', { body: input })
      },
      expireStaleSlotHolds(input = {}) {
        return backend.functions.invoke('expireStaleSlotHolds', { body: input })
      },
    },
  }

  return backend
}

function matchesFilters(
  row: Record<string, unknown>,
  options: BackendListOptions
): boolean {
  return (options.filters ?? []).every((filter) => {
    const value = row[filter.column]

    switch (filter.operator) {
      case 'eq':
        return value === filter.value
      case 'neq':
        return value !== filter.value
      case 'is':
        return value === filter.value
      case 'gt':
        return compareFilterValues(value, filter.value) > 0
      case 'gte':
        return compareFilterValues(value, filter.value) >= 0
      case 'lt':
        return compareFilterValues(value, filter.value) < 0
      case 'lte':
        return compareFilterValues(value, filter.value) <= 0
      case 'in':
        return matchesInFilter(value, filter.value)
      case 'like':
        return matchesLikeFilter(value, filter.value, true)
      case 'ilike':
        return matchesLikeFilter(value, filter.value, false)
      case 'fts':
        throw new Error('Unsupported fake backend filter operator: fts')
      default: {
        const operator: never = filter.operator
        throw new Error(`Unsupported fake backend filter operator: ${operator}`)
      }
    }
  })
}

function compareFilterValues(
  rowValue: unknown,
  filterValue: BackendFilterValue
): number {
  if (typeof rowValue === 'number' && typeof filterValue === 'number') {
    return rowValue - filterValue
  }

  if (typeof rowValue === 'string' && typeof filterValue === 'string') {
    return rowValue.localeCompare(filterValue)
  }

  throw new Error(
    `Unsupported fake backend comparison between ${typeof rowValue} and ${filterValueDescription(
      filterValue
    )}`
  )
}

function matchesInFilter(
  rowValue: unknown,
  filterValue: BackendFilterValue
): boolean {
  if (!Array.isArray(filterValue)) {
    throw new Error('Fake backend in filters require an array value')
  }

  return filterValue.some((candidate) => candidate === rowValue)
}

function matchesLikeFilter(
  rowValue: unknown,
  filterValue: BackendFilterValue,
  caseSensitive: boolean
): boolean {
  if (typeof filterValue !== 'string') {
    throw new Error('Fake backend like filters require string values')
  }

  if (rowValue === null || rowValue === undefined) return false

  if (typeof rowValue !== 'string') {
    throw new Error('Fake backend like filters require string values')
  }

  return likePatternToRegExp(filterValue, caseSensitive).test(rowValue)
}

function likePatternToRegExp(pattern: string, caseSensitive: boolean): RegExp {
  let source = '^'

  for (const character of pattern) {
    if (character === '%') {
      source += '.*'
    } else if (character === '_') {
      source += '.'
    } else {
      source += escapeRegExp(character)
    }
  }

  source += '$'
  return new RegExp(source, caseSensitive ? undefined : 'i')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function filterValueDescription(value: BackendFilterValue): string {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}
