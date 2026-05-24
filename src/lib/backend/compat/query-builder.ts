import {
  ButterbaseRequestError,
  type ButterbaseHttpClient,
} from '../butterbase/http-client'
import { toCompatError } from './errors'
import { baseColumns, hydrateRelations } from './relations'
import type {
  AuthMode,
  BackendCompatResponse,
  QueryFilter,
  QueryOperation,
  QueryOrder,
  QueryResponseMode,
  SelectOptions,
  TableName,
} from './types'

const primaryKeys: Partial<Record<TableName, string>> = {
  user_settings: 'profile_id',
}

const jsonbArrayColumns: Partial<Record<TableName, ReadonlySet<string>>> = {
  bookings: new Set(['booking_answers']),
  event_types: new Set(['invitee_questions']),
}

export class BackendQueryBuilder<TData = any>
  implements PromiseLike<BackendCompatResponse<TData>>
{
  private operation: QueryOperation = 'select'
  private filters: QueryFilter[] = []
  private orders: QueryOrder[] = []
  private selected = '*'
  private selectOptions: SelectOptions = {}
  private responseMode: QueryResponseMode = 'many'
  private limitCount?: number
  private offsetCount?: number
  private payload?: unknown
  private upsertOptions?: { onConflict?: string }

  constructor(
    private readonly httpClient: ButterbaseHttpClient,
    private readonly table: string,
    private readonly authMode: AuthMode
  ) {}

  select<TResult = any>(
    columns = '*',
    options: SelectOptions = {}
  ): BackendQueryBuilder<TResult> {
    this.operation = this.operation === 'select' ? 'select' : this.operation
    this.selected = columns
    this.selectOptions = options
    return this as unknown as BackendQueryBuilder<TResult>
  }

  insert<TResult = any>(payload: unknown): BackendQueryBuilder<TResult> {
    this.operation = 'insert'
    this.payload = payload
    return this as unknown as BackendQueryBuilder<TResult>
  }

  update<TResult = any>(payload: unknown): BackendQueryBuilder<TResult> {
    this.operation = 'update'
    this.payload = payload
    return this as unknown as BackendQueryBuilder<TResult>
  }

  upsert<TResult = any>(
    payload: unknown,
    options: { onConflict?: string } = {}
  ): BackendQueryBuilder<TResult> {
    this.operation = 'upsert'
    this.payload = payload
    this.upsertOptions = options
    return this as unknown as BackendQueryBuilder<TResult>
  }

  delete<TResult = any>(): BackendQueryBuilder<TResult> {
    this.operation = 'delete'
    return this as unknown as BackendQueryBuilder<TResult>
  }

  eq(column: string, value: unknown) {
    return this.addFilter(column, 'eq', value)
  }

  neq(column: string, value: unknown) {
    return this.addFilter(column, 'neq', value)
  }

  gt(column: string, value: unknown) {
    return this.addFilter(column, 'gt', value)
  }

  gte(column: string, value: unknown) {
    return this.addFilter(column, 'gte', value)
  }

  lt(column: string, value: unknown) {
    return this.addFilter(column, 'lt', value)
  }

  lte(column: string, value: unknown) {
    return this.addFilter(column, 'lte', value)
  }

  like(column: string, value: unknown) {
    return this.addFilter(column, 'like', value)
  }

  ilike(column: string, value: unknown) {
    return this.addFilter(column, 'ilike', value)
  }

  is(column: string, value: unknown) {
    return this.addFilter(column, 'is', value)
  }

  in(column: string, value: unknown[]) {
    return this.addFilter(column, 'in', value)
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({
      column,
      ascending: options.ascending ?? true,
    })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  offset(count: number) {
    this.offsetCount = count
    return this
  }

  single<TResult = TData>(): BackendQueryBuilder<TResult> {
    this.responseMode = 'single'
    return this as unknown as BackendQueryBuilder<TResult>
  }

  maybeSingle<TResult = TData>(): BackendQueryBuilder<TResult | null> {
    this.responseMode = 'maybeSingle'
    return this as unknown as BackendQueryBuilder<TResult | null>
  }

  then<TResult1 = BackendCompatResponse<TData>, TResult2 = never>(
    onfulfilled?:
      | ((value: BackendCompatResponse<TData>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private addFilter(column: string, operator: string, value: unknown) {
    this.filters.push({ column, operator, value })
    return this
  }

  private async execute(): Promise<BackendCompatResponse<TData>> {
    try {
      const rows = await this.executeOperation()
      const data = await this.shapeResponse(rows)

      return {
        data,
        error: null,
        count: this.selectOptions.count === 'exact' ? rows.length : null,
      } as BackendCompatResponse<TData>
    } catch (error) {
      return {
        data: null,
        error: toCompatError(error),
        count: null,
      }
    }
  }

  private async executeOperation(): Promise<unknown[]> {
    switch (this.operation) {
      case 'insert':
        return this.insertRows()
      case 'update':
        return this.updateRows()
      case 'delete':
        return this.deleteRows()
      case 'upsert':
        return this.upsertRows()
      case 'select':
      default:
        return this.fetchRows()
    }
  }

  private async fetchRows(extraFilters: QueryFilter[] = []) {
    const rows = await this.httpClient.request<unknown[]>({
      path: this.listPath(extraFilters),
      auth: this.authMode,
    })

    if (!Array.isArray(rows)) return rows ? [rows] : []
    await hydrateRelations(this.httpClient, this.authMode, this.selected, rows)
    return rows
  }

  private async insertRows() {
    const payloads = Array.isArray(this.payload) ? this.payload : [this.payload]
    const rows: unknown[] = []

    for (const payload of payloads) {
      rows.push(
        await this.httpClient.request({
          method: 'POST',
          path: `/v1/${this.httpClient.appId}/${this.table}`,
          auth: this.authMode,
          body: serializeJsonbArrayColumns(this.table, payload),
        })
      )
    }

    return rows
  }

  private async updateRows() {
    const directId = this.directPrimaryKeyFilterValue()
    if (directId !== null) {
      return [
        await this.httpClient.request({
          method: 'PATCH',
          path: `/v1/${this.httpClient.appId}/${this.table}/${encodeURIComponent(directId)}`,
          auth: this.authMode,
          body: serializeJsonbArrayColumns(this.table, this.payload),
        }),
      ]
    }

    const rows = await this.fetchRows()
    const updatedRows: unknown[] = []

    for (const row of rows) {
      const id = primaryKeyValue(this.table, row)
      updatedRows.push(
        await this.httpClient.request({
          method: 'PATCH',
          path: `/v1/${this.httpClient.appId}/${this.table}/${encodeURIComponent(id)}`,
          auth: this.authMode,
          body: serializeJsonbArrayColumns(this.table, this.payload),
        })
      )
    }

    return updatedRows
  }

  private async deleteRows() {
    const rows = await this.fetchRows()

    for (const row of rows) {
      const id = primaryKeyValue(this.table, row)
      await this.httpClient.request({
        method: 'DELETE',
        path: `/v1/${this.httpClient.appId}/${this.table}/${encodeURIComponent(id)}`,
        auth: this.authMode,
      })
    }

    return rows
  }

  private async upsertRows() {
    const payloads = Array.isArray(this.payload) ? this.payload : [this.payload]
    const rows: unknown[] = []
    const conflictColumns = (this.upsertOptions?.onConflict ?? primaryKeyFor(this.table))
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean)

    for (const payload of payloads) {
      const record = payload as Record<string, unknown>
      const filters = conflictColumns.map((column) => ({
        column,
        operator: 'eq',
        value: record[column],
      }))
      const matches = await this.fetchRows(filters)

      if (matches.length > 0) {
        const id = primaryKeyValue(this.table, matches[0])
        rows.push(
          await this.httpClient.request({
            method: 'PATCH',
            path: `/v1/${this.httpClient.appId}/${this.table}/${encodeURIComponent(id)}`,
            auth: this.authMode,
            body: serializeJsonbArrayColumns(this.table, payload),
          })
        )
      } else {
        rows.push(
          await this.httpClient.request({
            method: 'POST',
            path: `/v1/${this.httpClient.appId}/${this.table}`,
            auth: this.authMode,
            body: serializeJsonbArrayColumns(this.table, payload),
          })
        )
      }
    }

    return rows
  }

  private directPrimaryKeyFilterValue(): string | null {
    if (this.filters.length !== 1) return null

    const [filter] = this.filters
    if (filter.column !== primaryKeyFor(this.table) || filter.operator !== 'eq') {
      return null
    }

    if (typeof filter.value !== 'string' && typeof filter.value !== 'number') {
      return null
    }

    return String(filter.value)
  }

  private async shapeResponse(rows: unknown[]) {
    if (this.selectOptions.head) return null

    if (this.responseMode === 'single') {
      if (rows.length !== 1) {
        throw new ButterbaseRequestError(
          rows.length === 0 ? 'No rows returned' : 'Multiple rows returned',
          rows.length === 0 ? 404 : 406,
          rows.length === 0 ? 'PGRST116' : 'PGRST117'
        )
      }

      return rows[0]
    }

    if (this.responseMode === 'maybeSingle') {
      if (rows.length > 1) {
        throw new ButterbaseRequestError(
          'Multiple rows returned',
          406,
          'PGRST117'
        )
      }

      return rows[0] ?? null
    }

    return rows
  }

  private listPath(extraFilters: QueryFilter[] = []) {
    const params = new URLSearchParams()
    const baseSelect = baseColumns(this.selected)

    if (baseSelect && baseSelect !== '*') {
      params.set('select', baseSelect)
    }

    if (this.orders.length > 0) {
      params.set(
        'order',
        this.orders
          .map((order) => `${order.column}.${order.ascending ? 'asc' : 'desc'}`)
          .join(',')
      )
    }

    if (this.limitCount !== undefined) params.set('limit', String(this.limitCount))
    if (this.offsetCount !== undefined) {
      params.set('offset', String(this.offsetCount))
    }

    for (const filter of [...this.filters, ...extraFilters]) {
      params.append(
        filter.column,
        `${filter.operator}.${serializeFilterValue(filter.value)}`
      )
    }

    const query = params.toString()
    return `/v1/${this.httpClient.appId}/${this.table}${query ? `?${query}` : ''}`
  }
}

function primaryKeyFor(table: string) {
  return primaryKeys[table as TableName] ?? 'id'
}

function primaryKeyValue(table: string, row: unknown) {
  const record = row as Record<string, unknown>
  const key = primaryKeyFor(table)
  const value = record[key]

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ButterbaseRequestError(
      `Cannot resolve primary key ${key} for ${table}`,
      400,
      'MISSING_PRIMARY_KEY'
    )
  }

  return String(value)
}

function serializeJsonbArrayColumns(table: string, payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }

  const columns = jsonbArrayColumns[table as TableName]
  if (!columns) return payload

  let serialized: Record<string, unknown> | null = null
  const record = payload as Record<string, unknown>

  for (const column of columns) {
    if (!Array.isArray(record[column])) continue
    serialized ??= { ...record }
    serialized[column] = JSON.stringify(record[column])
  }

  return serialized ?? payload
}

function serializeFilterValue(value: unknown) {
  if (Array.isArray(value)) return `(${value.join(',')})`
  if (value === null) return 'null'
  return String(value)
}
