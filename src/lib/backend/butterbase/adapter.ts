import type {
  CancelBookingInput,
  CancelBookingResult,
  ConfirmBookingInput,
  ConfirmBookingResult,
  CreateHoldInput,
  CreateHoldResult,
  RescheduleBookingInput,
  RescheduleBookingResult,
} from '@/lib/booking/types'
import type { Json, Tables } from '@/lib/types/database'
import { backendFunctionSlugs } from '../functions'
import type {
  BackendAuthPort,
  BackendDataAuthOptions,
  BackendDataPort,
  BackendFunctionRequest,
  BackendFunctionsPort,
  BackendListOptions,
  BackendPorts,
  BackendReadOptions,
  BackendResult,
  BackendWriteOptions,
  BackendTransactionsPort,
  ClaimWorkerOptions,
  ExpireStaleSlotHoldsInput,
  ExpireStaleSlotHoldsResult,
  PublicRateLimitDecision,
  PublicRateLimitInput,
} from '../ports'
import type {
  BackendInsert,
  BackendRow,
  BackendTable,
  BackendUpdate,
} from '../types'
import {
  type ButterbaseBackendConfig,
  resolveButterbaseConfig,
} from './config'
import { ButterbaseHttpClient } from './http-client'

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

export function createButterbaseBackend(
  config: Partial<ButterbaseBackendConfig> = {}
): BackendPorts {
  const resolved = resolveButterbaseConfig(config)
  const client = new ButterbaseHttpClient(resolved)
  const functions = new ButterbaseFunctionsPort(client)

  return {
    provider: 'butterbase',
    auth: new ButterbaseAuthPort(client),
    data: new ButterbaseDataPort(client),
    functions,
    transactions: new ButterbaseTransactionsPort(functions),
  }
}

class ButterbaseAuthPort implements BackendAuthPort {
  constructor(private readonly client: ButterbaseHttpClient) {}

  async getCurrentUser(accessToken?: string) {
    const result = await this.client.result<ButterbaseAuthUser>({
      path: `/auth/${this.client.appId}/me`,
      auth: accessToken ? 'none' : 'user',
      accessToken,
    })

    return mapResult(result, mapUser)
  }

  async signInWithPassword(input: { email: string; password: string }) {
    const result = await this.client.result<ButterbaseAuthSession>({
      method: 'POST',
      path: `/auth/${this.client.appId}/login`,
      auth: 'none',
      body: input,
    })

    return mapResult(result, mapSession)
  }

  async signUp(input: {
    email: string
    password: string
    displayName?: string
  }) {
    const result = await this.client.result<ButterbaseAuthUser>({
      method: 'POST',
      path: `/auth/${this.client.appId}/signup`,
      auth: 'none',
      body: {
        email: input.email,
        password: input.password,
        display_name: input.displayName,
      },
    })

    return mapResult(result, mapUser)
  }

  async refreshSession(refreshToken: string) {
    const result = await this.client.result<ButterbaseAuthSession>({
      method: 'POST',
      path: `/auth/${this.client.appId}/refresh`,
      auth: 'none',
      body: { refresh_token: refreshToken },
    })

    return mapResult(result, mapSession)
  }

  async signOut(accessToken: string) {
    return this.client.result<{ success: true }>({
      method: 'POST',
      path: `/auth/${this.client.appId}/logout`,
      auth: 'none',
      accessToken,
    })
  }

  async requestPasswordReset(input: { email: string }) {
    return this.client.result<{ success: true }>({
      method: 'POST',
      path: `/auth/${this.client.appId}/forgot-password`,
      auth: 'none',
      body: { email: input.email },
    })
  }

  async resetPassword(input: {
    email: string
    code: string
    newPassword: string
  }) {
    return this.client.result<{ success: true }>({
      method: 'POST',
      path: `/auth/${this.client.appId}/reset-password`,
      auth: 'none',
      body: {
        email: input.email,
        code: input.code,
        new_password: input.newPassword,
      },
    })
  }
}

class ButterbaseDataPort implements BackendDataPort {
  constructor(private readonly client: ButterbaseHttpClient) {}

  async list<TTable extends BackendTable>(
    table: TTable,
    options: BackendListOptions = {}
  ): Promise<BackendResult<Array<BackendRow<TTable>>>> {
    return this.client.result<Array<BackendRow<TTable>>>({
      path: this.tablePath(table, options),
      ...dataRequestAuth(options),
    })
  }

  async getById<TTable extends BackendTable>(
    table: TTable,
    id: string,
    options: BackendReadOptions = {}
  ): Promise<BackendResult<BackendRow<TTable>>> {
    return this.client.result<BackendRow<TTable>>({
      path: this.rowPath(table, id, options),
      ...dataRequestAuth(options),
    })
  }

  async insert<TTable extends BackendTable>(
    table: TTable,
    row: BackendInsert<TTable>,
    options: BackendWriteOptions = {}
  ): Promise<BackendResult<BackendRow<TTable>>> {
    return this.client.result<BackendRow<TTable>, BackendInsert<TTable>>({
      method: 'POST',
      path: `/v1/${this.client.appId}/${table}`,
      body: row,
      ...dataRequestAuth(options),
    })
  }

  async update<TTable extends BackendTable>(
    table: TTable,
    id: string,
    patch: BackendUpdate<TTable>,
    options: BackendWriteOptions = {}
  ): Promise<BackendResult<BackendRow<TTable>>> {
    return this.client.result<BackendRow<TTable>, BackendUpdate<TTable>>({
      method: 'PATCH',
      path: `/v1/${this.client.appId}/${table}/${encodeURIComponent(id)}`,
      body: patch,
      ...dataRequestAuth(options),
    })
  }

  async remove<TTable extends BackendTable>(
    table: TTable,
    id: string,
    options: BackendWriteOptions = {}
  ): Promise<BackendResult<{ success: true }>> {
    return this.client.result<{ success: true }>({
      method: 'DELETE',
      path: `/v1/${this.client.appId}/${table}/${encodeURIComponent(id)}`,
      ...dataRequestAuth(options),
    })
  }

  private tablePath<TTable extends BackendTable>(
    table: TTable,
    options: BackendListOptions
  ): string {
    const params = new URLSearchParams()

    if (options.select) params.set('select', options.select)
    if (options.order) params.set('order', options.order)
    if (options.limit !== undefined) params.set('limit', String(options.limit))
    if (options.offset !== undefined) params.set('offset', String(options.offset))

    for (const filter of options.filters ?? []) {
      params.append(
        filter.column,
        `${filter.operator}.${serializeFilterValue(filter.value)}`
      )
    }

    const query = params.toString()
    return `/v1/${this.client.appId}/${table}${query ? `?${query}` : ''}`
  }

  private rowPath<TTable extends BackendTable>(
    table: TTable,
    id: string,
    options: BackendReadOptions
  ): string {
    const params = new URLSearchParams()
    if (options.select) params.set('select', options.select)

    const query = params.toString()
    return `/v1/${this.client.appId}/${table}/${encodeURIComponent(id)}${
      query ? `?${query}` : ''
    }`
  }
}

function dataRequestAuth(options: BackendDataAuthOptions): {
  auth: 'none' | 'service' | 'user'
  accessToken?: string
} {
  if (options.serviceRole) return { auth: 'service' }
  if (options.accessToken) {
    return { auth: 'none', accessToken: options.accessToken }
  }

  return { auth: 'user' }
}

class ButterbaseFunctionsPort implements BackendFunctionsPort {
  constructor(private readonly client: ButterbaseHttpClient) {}

  async invoke<TResponse = Json, TBody = Json>(
    name: keyof typeof backendFunctionSlugs,
    request: BackendFunctionRequest<TBody> = {}
  ): Promise<BackendResult<TResponse>> {
    const slug = backendFunctionSlugs[name]

    return this.client.result<TResponse, TBody>({
      method: request.method ?? 'POST',
      path: `/v1/${this.client.appId}/fn/${slug}`,
      auth: 'none',
      accessToken: request.accessToken ?? this.client.functionAccessToken(),
      headers: request.headers,
      body: request.body,
    })
  }
}

class ButterbaseTransactionsPort implements BackendTransactionsPort {
  constructor(private readonly functions: BackendFunctionsPort) {}

  createSlotHold(input: CreateHoldInput) {
    return this.functions.invoke<CreateHoldResult, CreateHoldInput>(
      'createSlotHold',
      { body: input, serviceRole: true }
    )
  }

  confirmBooking(input: ConfirmBookingInput) {
    return this.functions.invoke<ConfirmBookingResult, ConfirmBookingInput>(
      'confirmBooking',
      { body: input, serviceRole: true }
    )
  }

  cancelBooking(input: CancelBookingInput) {
    return this.functions.invoke<CancelBookingResult, CancelBookingInput>(
      'cancelBooking',
      { body: input, serviceRole: true }
    )
  }

  rescheduleBooking(input: RescheduleBookingInput) {
    return this.functions.invoke<RescheduleBookingResult, RescheduleBookingInput>(
      'rescheduleBooking',
      { body: input, serviceRole: true }
    )
  }

  claimOutboxEvents(input: ClaimWorkerOptions = {}) {
    return this.functions.invoke<Array<Tables<'outbox_events'>>, ClaimWorkerOptions>(
      'claimOutboxEvents',
      { body: input, serviceRole: true }
    )
  }

  claimWebhookDeliveries(input: ClaimWorkerOptions = {}) {
    return this.functions.invoke<
      Array<Tables<'webhook_deliveries'>>,
      ClaimWorkerOptions
    >('claimWebhookDeliveries', { body: input, serviceRole: true })
  }

  consumePublicRateLimit(input: PublicRateLimitInput) {
    return this.functions.invoke<PublicRateLimitDecision, PublicRateLimitInput>(
      'consumePublicRateLimit',
      { body: input, serviceRole: true }
    )
  }

  expireStaleSlotHolds(input: ExpireStaleSlotHoldsInput = {}) {
    return this.functions.invoke<
      ExpireStaleSlotHoldsResult,
      ExpireStaleSlotHoldsInput
    >('expireStaleSlotHolds', { body: input, serviceRole: true })
  }
}

function serializeFilterValue(value: Json | Array<string | number | boolean>): string {
  if (Array.isArray(value)) {
    return `(${value.join(',')})`
  }

  if (value === null) return 'null'
  return String(value)
}

function mapUser(user: ButterbaseAuthUser) {
  return {
    id: user.id,
    email: user.email ?? null,
    emailVerified: user.email_verified,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  }
}

function mapSession(session: ButterbaseAuthSession) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    tokenType: session.token_type,
    user: mapUser(session.user),
  }
}

function mapResult<TInput, TOutput>(
  result: BackendResult<TInput>,
  mapper: (value: TInput) => TOutput
): BackendResult<TOutput> {
  if (result.error) return result
  return { data: mapper(result.data), error: null }
}
