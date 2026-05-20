import type { Database, Json } from '@/lib/types/database'
import { backendFunctionSlugs } from '../functions'
import type { BackendError, BackendFunctionName } from '../ports'
import { resolveButterbaseConfig } from '../butterbase/config'
import {
  ButterbaseHttpClient,
  ButterbaseRequestError,
  type ButterbaseHttpClientConfig,
} from '../butterbase/http-client'

type TableName = keyof Database['public']['Tables'] & string
type QueryOperation = 'select' | 'insert' | 'update' | 'delete' | 'upsert'
type QueryResponseMode = 'many' | 'single' | 'maybeSingle'
type AuthMode = 'none' | 'service' | 'user'

export interface BackendCompatError {
  message: string
  code?: string
  status?: number
  details?: unknown
}

export interface BackendCompatResponse<TData = any> {
  data: TData | null
  error: BackendCompatError | null
  count?: number | null
}

export interface BackendCompatUser {
  id: string
  email: string | null
  user_metadata?: Record<string, unknown>
}

export interface BackendCompatSession {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  user: BackendCompatUser
}

export interface BackendCompatClient<TDatabase = Database> {
  auth: {
    getUser(): Promise<{
      data: { user: BackendCompatUser | null }
      error: BackendCompatError | null
    }>
    getSession(): Promise<{
      data: { session: BackendCompatSession | null }
      error: BackendCompatError | null
    }>
    signInWithPassword(input: {
      email: string
      password: string
    }): Promise<BackendCompatResponse<BackendCompatSession>>
    signUp(input: {
      email: string
      password: string
      options?: { data?: { full_name?: string; name?: string } }
    }): Promise<BackendCompatResponse<{ user: BackendCompatUser | null }>>
    updateUser(input: {
      userId?: string
      email?: string
      password?: string
    }): Promise<BackendCompatResponse<{ user: BackendCompatUser | null }>>
    resetPasswordForEmail(
      email: string,
      options?: { redirectTo?: string }
    ): Promise<BackendCompatResponse<{ success: true }>>
    exchangeCodeForSession(
      code: string
    ): Promise<BackendCompatResponse<BackendCompatSession>>
    signOut(): Promise<BackendCompatResponse<{ success: true }>>
    admin?: {
      deleteUser(
        userId: string
      ): Promise<BackendCompatResponse<{ success: true }>>
    }
  }
  from(table: TableName | string): BackendQueryBuilder<any>
  rpc(name: string, params?: Record<string, unknown>): BackendRpcBuilder<any>
}

interface CreateBackendCompatClientOptions
  extends Partial<ButterbaseHttpClientConfig> {
  accessToken?: string
  authMode?: AuthMode
}

interface QueryFilter {
  column: string
  operator: string
  value: unknown
}

interface QueryOrder {
  column: string
  ascending: boolean
}

interface SelectOptions {
  count?: 'exact' | null
  head?: boolean
}

const primaryKeys: Partial<Record<TableName, string>> = {
  user_settings: 'profile_id',
}

export function createBackendCompatClient<TDatabase = Database>(
  options: CreateBackendCompatClientOptions = {}
): BackendCompatClient<TDatabase> {
  const config = resolveButterbaseConfig(options)
  const httpClient = new ButterbaseHttpClient({
    ...config,
    accessToken: options.accessToken,
    fetchImpl: options.fetchImpl,
  })
  const authMode = options.authMode ?? (options.accessToken ? 'user' : 'service')

  return {
    auth: new BackendCompatAuth(httpClient, authMode),
    from(table) {
      return new BackendQueryBuilder(httpClient, table, authMode)
    },
    rpc(name, params = {}) {
      return new BackendRpcBuilder(httpClient, name, params, authMode)
    },
  }
}

type BackendCompatAuthPort = BackendCompatClient['auth']

class BackendCompatAuth implements BackendCompatAuthPort {
  admin?: BackendCompatClient['auth']['admin']

  constructor(
    private readonly httpClient: ButterbaseHttpClient,
    private readonly authMode: AuthMode
  ) {
    if (authMode === 'service') {
      this.admin = {
        deleteUser: async (userId: string) =>
          invokeCompatFunction(this.httpClient, 'deleteAuthUser', { userId }),
      }
    }
  }

  async getUser() {
    const response = await requestAsCompat<ButterbaseAuthUser>(this.httpClient, {
      path: `/auth/${this.httpClient.appId}/me`,
      auth: this.authMode === 'user' ? 'user' : 'none',
    })

    return {
      data: { user: response.data ? mapAuthUser(response.data) : null },
      error: response.error,
    }
  }

  async getSession() {
    const userResponse = await this.getUser()
    if (userResponse.error || !userResponse.data.user) {
      return {
        data: { session: null },
        error: userResponse.error,
      }
    }

    return {
      data: { session: null },
      error: null,
    }
  }

  async signInWithPassword(input: { email: string; password: string }) {
    const response = await requestAsCompat<ButterbaseAuthSession>(
      this.httpClient,
      {
        method: 'POST',
        path: `/auth/${this.httpClient.appId}/login`,
        auth: 'none',
        body: input,
      }
    )

    return mapCompatResponse(response, mapAuthSession)
  }

  async signUp(input: {
    email: string
    password: string
    options?: { data?: { full_name?: string; name?: string } }
  }) {
    const displayName =
      input.options?.data?.full_name ?? input.options?.data?.name ?? undefined
    const response = await requestAsCompat<ButterbaseAuthUser>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/signup`,
      auth: 'none',
      body: {
        email: input.email,
        password: input.password,
        display_name: displayName,
      },
    })

    return mapCompatResponse(response, (user) => ({
      user: user ? mapAuthUser(user) : null,
    }))
  }

  async updateUser(input: {
    userId?: string
    email?: string
    password?: string
  }) {
    const result = await invokeCompatFunction<unknown>(
      this.httpClient,
      'updateAuthUser',
      input
    )
    if (result.error) return { data: null, error: result.error }
    return { data: { user: null }, error: null }
  }

  async resetPasswordForEmail(email: string) {
    return requestAsCompat<{ success: true }>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/forgot-password`,
      auth: 'none',
      body: { email },
    })
  }

  async exchangeCodeForSession(code: string) {
    return requestAsCompat<BackendCompatSession>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/magic-link/verify`,
      auth: 'none',
      body: { code },
    })
  }

  async signOut() {
    return requestAsCompat<{ success: true }>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/logout`,
      auth: this.authMode,
    })
  }
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
          body: payload,
        })
      )
    }

    return rows
  }

  private async updateRows() {
    const rows = await this.fetchRows()
    const updatedRows: unknown[] = []

    for (const row of rows) {
      const id = primaryKeyValue(this.table, row)
      updatedRows.push(
        await this.httpClient.request({
          method: 'PATCH',
          path: `/v1/${this.httpClient.appId}/${this.table}/${encodeURIComponent(id)}`,
          auth: this.authMode,
          body: this.payload,
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
            body: payload,
          })
        )
      } else {
        rows.push(
          await this.httpClient.request({
            method: 'POST',
            path: `/v1/${this.httpClient.appId}/${this.table}`,
            auth: this.authMode,
            body: payload,
          })
        )
      }
    }

    return rows
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

export class BackendRpcBuilder<TData = any>
  implements PromiseLike<BackendCompatResponse<TData>>
{
  private responseMode: QueryResponseMode = 'many'

  constructor(
    private readonly httpClient: ButterbaseHttpClient,
    private readonly name: string,
    private readonly params: Record<string, unknown>,
    private readonly authMode: AuthMode
  ) {}

  single<TResult = TData>(): BackendRpcBuilder<TResult> {
    this.responseMode = 'single'
    return this as unknown as BackendRpcBuilder<TResult>
  }

  maybeSingle<TResult = TData>(): BackendRpcBuilder<TResult | null> {
    this.responseMode = 'maybeSingle'
    return this as unknown as BackendRpcBuilder<TResult | null>
  }

  then<TResult1 = BackendCompatResponse<TData>, TResult2 = never>(
    onfulfilled?:
      | ((value: BackendCompatResponse<TData>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<BackendCompatResponse<TData>> {
    try {
      const rows = await this.invoke()
      const data = this.shapeResponse(rows)
      return { data: data as TData, error: null, count: null }
    } catch (error) {
      return { data: null, error: toCompatError(error), count: null }
    }
  }

  private async invoke(): Promise<unknown[]> {
    const mapped = mapRpcToFunction(this.name, this.params)
    const result = await this.httpClient.request<unknown>({
      method: 'POST',
      path: `/v1/${this.httpClient.appId}/fn/${mapped.slug}`,
      auth: mapped.serviceRole ? 'none' : this.authMode,
      accessToken: mapped.serviceRole
        ? this.httpClient.functionAccessToken()
        : undefined,
      body: mapped.body,
    })

    return normalizeRpcResult(this.name, result)
  }

  private shapeResponse(rows: unknown[]) {
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
}

interface ButterbaseAuthUser {
  id: string
  email?: string | null
  email_verified?: boolean
  display_name?: string | null
  avatar_url?: string | null
}

interface ButterbaseAuthSession {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  user: ButterbaseAuthUser
}

async function requestAsCompat<TResponse>(
  httpClient: ButterbaseHttpClient,
  options: Parameters<ButterbaseHttpClient['request']>[0]
): Promise<BackendCompatResponse<TResponse>> {
  try {
    return {
      data: await httpClient.request<TResponse>(options),
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: toCompatError(error),
    }
  }
}

async function invokeCompatFunction<TResponse = { success: true }>(
  httpClient: ButterbaseHttpClient,
  name: BackendFunctionName | 'deleteAuthUser' | 'updateAuthUser',
  body: unknown
): Promise<BackendCompatResponse<TResponse>> {
  const slug =
    name in backendFunctionSlugs
      ? backendFunctionSlugs[name as BackendFunctionName]
      : kebabCase(name)

  return requestAsCompat<TResponse>(httpClient, {
    method: 'POST',
    path: `/v1/${httpClient.appId}/fn/${slug}`,
    auth: 'none',
    accessToken: httpClient.functionAccessToken(),
    body,
  })
}

function mapRpcToFunction(name: string, params: Record<string, unknown>) {
  switch (name) {
    case 'confirm_booking':
      return {
        slug: backendFunctionSlugs.confirmBooking,
        serviceRole: true,
        body: {
          holdToken: params.p_hold_token,
          guestName: params.p_guest_name,
          guestEmail: params.p_guest_email,
          guestTimezone: params.p_guest_timezone,
          notes: params.p_notes,
          answers: params.p_booking_answers,
          locationType: params.p_location_type,
          locationValue: params.p_location_value,
          conferenceProvider: params.p_conference_provider,
          conferenceStatus: params.p_conference_status,
        },
      }
    case 'cancel_booking':
      return {
        slug: backendFunctionSlugs.cancelBooking,
        serviceRole: true,
        body: {
          cancellationToken: params.p_cancellation_token,
          cancelReason: params.p_cancel_reason,
        },
      }
    case 'create_slot_hold_with_reservation':
      return {
        slug: backendFunctionSlugs.createSlotHold,
        serviceRole: true,
        body: {
          eventTypeId: params.p_event_type_id,
          hostUserId: params.p_host_user_id,
          startAt: params.p_start_at,
          endAt: params.p_end_at,
          guestEmail: params.p_guest_email,
          expiresAt: params.p_expires_at,
        },
      }
    case 'reschedule_booking_with_hold':
      return {
        slug: backendFunctionSlugs.rescheduleBooking,
        serviceRole: true,
        body: {
          rescheduleToken: params.p_reschedule_token,
          holdToken: params.p_hold_token,
          guestName: params.p_guest_name,
          guestEmail: params.p_guest_email,
          guestTimezone: params.p_guest_timezone,
          notes: params.p_notes,
          answers: params.p_booking_answers,
        },
      }
    case 'claim_outbox_events':
      return {
        slug: backendFunctionSlugs.claimOutboxEvents,
        serviceRole: true,
        body: {
          limit: params.p_limit,
          maxAttempts: params.p_max_attempts,
        },
      }
    case 'claim_webhook_deliveries':
      return {
        slug: backendFunctionSlugs.claimWebhookDeliveries,
        serviceRole: true,
        body: {
          limit: params.p_limit,
          maxAttempts: params.p_max_attempts,
        },
      }
    case 'consume_public_rate_limit':
      return {
        slug: backendFunctionSlugs.consumePublicRateLimit,
        serviceRole: true,
        body: {
          scope: params.p_scope,
          identifierHash: params.p_identifier_hash,
          limit: params.p_limit_count,
          windowSeconds: params.p_window_seconds,
        },
      }
    case 'expire_stale_slot_holds':
      return {
        slug: backendFunctionSlugs.expireStaleSlotHolds,
        serviceRole: true,
        body: { limit: params.p_limit },
      }
    case 'set_default_schedule':
      return {
        slug: 'set-default-schedule',
        serviceRole: true,
        body: {
          userId: params.p_user_id,
          scheduleId: params.p_schedule_id,
        },
      }
    case 'anonymize_contact_bookings':
      return {
        slug: 'anonymize-contact-bookings',
        serviceRole: true,
        body: {
          contactId: params.p_contact_id,
          hostUserId: params.p_host_user_id,
        },
      }
    default:
      return {
        slug: kebabCase(name),
        serviceRole: true,
        body: params,
      }
  }
}

function normalizeRpcResult(name: string, result: unknown) {
  if (name === 'confirm_booking') {
    if (Array.isArray(result)) return result
    const row = result as Record<string, unknown>
    return [
      {
        booking_id: row.bookingId ?? row.booking_id,
        cancellation_token: row.cancellationToken ?? row.cancellation_token,
        reschedule_token: row.rescheduleToken ?? row.reschedule_token,
        conference_status: row.conferenceStatus ?? row.conference_status,
        conference_url: row.conferenceUrl ?? row.conference_url,
      },
    ]
  }

  if (name === 'cancel_booking') {
    if (Array.isArray(result)) return result
    return [result ?? { success: true }]
  }

  if (name === 'create_slot_hold_with_reservation') {
    const hold = result as Record<string, unknown>
    return [
      {
        hold_id: hold.holdId ?? hold.hold_id,
        hold_token: hold.holdToken ?? hold.hold_token,
        expires_at: hold.expiresAt ?? hold.expires_at,
      },
    ]
  }

  if (name === 'reschedule_booking_with_hold') {
    if (Array.isArray(result)) return result
    const row = result as Record<string, unknown>
    return [
      {
        old_booking_id: row.previousBookingId ?? row.old_booking_id,
        new_booking_id: row.bookingId ?? row.new_booking_id,
        event_type_id: row.eventTypeId ?? row.event_type_id,
        host_user_id: row.hostUserId ?? row.host_user_id,
        start_at: row.startAt ?? row.start_at,
        end_at: row.endAt ?? row.end_at,
        previous_start_at: row.previousStartAt ?? row.previous_start_at,
        previous_end_at: row.previousEndAt ?? row.previous_end_at,
        cancellation_token: row.cancellationToken ?? row.cancellation_token,
        reschedule_token: row.rescheduleToken ?? row.reschedule_token,
        conference_status: row.conferenceStatus ?? row.conference_status,
        conference_url: row.conferenceUrl ?? row.conference_url,
      },
    ]
  }

  if (name === 'anonymize_contact_bookings') {
    if (typeof result === 'number') return [result]
    if (result && typeof result === 'object') {
      return [(result as Record<string, unknown>).anonymizedBookings ?? 0]
    }
  }

  return Array.isArray(result) ? result : [result]
}

async function hydrateRelations(
  httpClient: ButterbaseHttpClient,
  authMode: AuthMode,
  selected: string,
  rows: unknown[]
) {
  const relations = relationSelections(selected)
  if (!relations.some((relation) => relation.name === 'event_types')) return

  const eventTypeIds = Array.from(
    new Set(
      rows
        .map((row) => (row as Record<string, unknown>).event_type_id)
        .filter((value): value is string => typeof value === 'string')
    )
  )

  if (eventTypeIds.length === 0) return

  const params = new URLSearchParams()
  params.set('id', `in.(${eventTypeIds.join(',')})`)
  const eventTypeRelation = relations.find(
    (relation) => relation.name === 'event_types'
  )
  if (eventTypeRelation?.columns) {
    params.set('select', `id,${eventTypeRelation.columns}`)
  }

  const eventTypes = await httpClient.request<Record<string, unknown>[]>({
    path: `/v1/${httpClient.appId}/event_types?${params.toString()}`,
    auth: authMode,
  })
  const eventTypesById = new Map(
    eventTypes.map((eventType) => [String(eventType.id), eventType])
  )

  for (const row of rows) {
    const record = row as Record<string, unknown>
    const eventTypeId = record.event_type_id
    record.event_types =
      typeof eventTypeId === 'string'
        ? eventTypesById.get(eventTypeId) ?? null
        : null
  }
}

function relationSelections(selected: string) {
  const relations: Array<{ name: string; columns: string }> = []
  const matcher = /(\w+)\(([^)]*)\)/g
  let match = matcher.exec(selected)

  while (match) {
    relations.push({
      name: match[1],
      columns: match[2].trim(),
    })
    match = matcher.exec(selected)
  }

  return relations
}

function baseColumns(selected: string) {
  return selected
    .replace(/\w+\([^)]*\)/g, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',')
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

function serializeFilterValue(value: unknown) {
  if (Array.isArray(value)) return `(${value.join(',')})`
  if (value === null) return 'null'
  return String(value)
}

function mapAuthUser(user: ButterbaseAuthUser): BackendCompatUser {
  return {
    id: user.id,
    email: user.email ?? null,
    user_metadata: {
      full_name: user.display_name ?? null,
      avatar_url: user.avatar_url ?? null,
      email_verified: user.email_verified ?? false,
    },
  }
}

function mapAuthSession(session: ButterbaseAuthSession): BackendCompatSession {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: mapAuthUser(session.user),
  }
}

function mapCompatResponse<TInput, TOutput>(
  response: BackendCompatResponse<TInput>,
  mapper: (data: TInput) => TOutput
): BackendCompatResponse<TOutput> {
  if (response.error || response.data === null) {
    return { data: null, error: response.error }
  }

  return { data: mapper(response.data), error: null }
}

function toCompatError(error: unknown): BackendCompatError {
  if (error instanceof ButterbaseRequestError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.body,
    }
  }

  const backendError = error as BackendError
  if (backendError?.message) {
    return {
      message: backendError.message,
      code: backendError.code,
      status: backendError.status,
      details: backendError.cause,
    }
  }

  return {
    message: error instanceof Error ? error.message : 'Backend request failed',
    details: error,
  }
}

function kebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}
