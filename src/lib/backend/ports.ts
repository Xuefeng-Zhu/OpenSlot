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
import type {
  BackendInsert,
  BackendProvider,
  BackendRow,
  BackendTable,
  BackendUpdate,
} from './types'

export interface BackendError {
  message: string
  code?: string
  status?: number
  remediation?: string
  cause?: unknown
}

export type BackendResult<TData> =
  | { data: TData; error: null }
  | { data: null; error: BackendError }

export type BackendFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'in'
  | 'fts'

export type BackendFilterValue =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean>

export interface BackendFilter {
  column: string
  operator: BackendFilterOperator
  value: BackendFilterValue
}

export interface BackendListOptions {
  select?: string
  filters?: BackendFilter[]
  order?: string
  limit?: number
  offset?: number
}

export interface BackendUser {
  id: string
  email: string | null
  emailVerified?: boolean
  displayName?: string | null
  avatarUrl?: string | null
}

export interface BackendSession {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
  user: BackendUser
}

export interface BackendAuthPort {
  getCurrentUser(accessToken?: string): Promise<BackendResult<BackendUser>>
  signInWithPassword(input: {
    email: string
    password: string
  }): Promise<BackendResult<BackendSession>>
  signUp(input: {
    email: string
    password: string
    displayName?: string
  }): Promise<BackendResult<BackendUser>>
  refreshSession(refreshToken: string): Promise<BackendResult<BackendSession>>
  signOut(accessToken: string): Promise<BackendResult<{ success: true }>>
  requestPasswordReset(input: {
    email: string
  }): Promise<BackendResult<{ success: true }>>
  resetPassword(input: {
    email: string
    code: string
    newPassword: string
  }): Promise<BackendResult<{ success: true }>>
}

export interface BackendDataPort {
  list<TTable extends BackendTable>(
    table: TTable,
    options?: BackendListOptions
  ): Promise<BackendResult<Array<BackendRow<TTable>>>>
  getById<TTable extends BackendTable>(
    table: TTable,
    id: string,
    options?: Pick<BackendListOptions, 'select'>
  ): Promise<BackendResult<BackendRow<TTable>>>
  insert<TTable extends BackendTable>(
    table: TTable,
    row: BackendInsert<TTable>
  ): Promise<BackendResult<BackendRow<TTable>>>
  update<TTable extends BackendTable>(
    table: TTable,
    id: string,
    patch: BackendUpdate<TTable>
  ): Promise<BackendResult<BackendRow<TTable>>>
  remove<TTable extends BackendTable>(
    table: TTable,
    id: string
  ): Promise<BackendResult<{ success: true }>>
}

export type BackendFunctionName =
  | 'createSlotHold'
  | 'confirmBooking'
  | 'cancelBooking'
  | 'rescheduleBooking'
  | 'claimOutboxEvents'
  | 'claimWebhookDeliveries'
  | 'consumePublicRateLimit'
  | 'expireStaleSlotHolds'

export interface BackendFunctionRequest<TBody = Json> {
  body?: TBody
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  accessToken?: string
  serviceRole?: boolean
}

export interface BackendFunctionsPort {
  invoke<TResponse = Json, TBody = Json>(
    name: BackendFunctionName,
    request?: BackendFunctionRequest<TBody>
  ): Promise<BackendResult<TResponse>>
}

export interface ClaimWorkerOptions {
  limit?: number
  maxAttempts?: number
}

export interface PublicRateLimitInput {
  scope: string
  identifierHash: string
  limit: number
  windowSeconds: number
  now?: string
}

export interface PublicRateLimitDecision {
  allowed: boolean
  limitCount: number
  remaining: number
  resetAt: string
  retryAfterSeconds: number
}

export interface ExpireStaleSlotHoldsInput {
  limit?: number
  now?: string
}

export interface ExpireStaleSlotHoldsResult {
  expiredHolds: number
  expiredReservations: number
}

export interface BackendTransactionsPort {
  createSlotHold(input: CreateHoldInput): Promise<BackendResult<CreateHoldResult>>
  confirmBooking(
    input: ConfirmBookingInput
  ): Promise<BackendResult<ConfirmBookingResult>>
  cancelBooking(
    input: CancelBookingInput
  ): Promise<BackendResult<CancelBookingResult>>
  rescheduleBooking(
    input: RescheduleBookingInput
  ): Promise<BackendResult<RescheduleBookingResult>>
  claimOutboxEvents(
    input?: ClaimWorkerOptions
  ): Promise<BackendResult<Array<Tables<'outbox_events'>>>>
  claimWebhookDeliveries(
    input?: ClaimWorkerOptions
  ): Promise<BackendResult<Array<Tables<'webhook_deliveries'>>>>
  consumePublicRateLimit(
    input: PublicRateLimitInput
  ): Promise<BackendResult<PublicRateLimitDecision>>
  expireStaleSlotHolds(
    input?: ExpireStaleSlotHoldsInput
  ): Promise<BackendResult<ExpireStaleSlotHoldsResult>>
}

export interface BackendPorts {
  provider: BackendProvider
  auth: BackendAuthPort
  data: BackendDataPort
  functions: BackendFunctionsPort
  transactions: BackendTransactionsPort
}

export function backendSuccess<TData>(data: TData): BackendResult<TData> {
  return { data, error: null }
}

export function backendFailure<TData = never>(
  error: BackendError
): BackendResult<TData> {
  return { data: null, error }
}
