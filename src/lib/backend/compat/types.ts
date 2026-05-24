import type { Database } from '@/lib/types/database'
import type { ButterbaseHttpClientConfig } from '../butterbase/http-client'
import type { BackendQueryBuilder } from './query-builder'
import type { BackendRpcBuilder } from './rpc-builder'

export type TableName = keyof Database['public']['Tables'] & string
export type QueryOperation = 'select' | 'insert' | 'update' | 'delete' | 'upsert'
export type QueryResponseMode = 'many' | 'single' | 'maybeSingle'
export type AuthMode = 'none' | 'service' | 'user'

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

export interface BackendCompatAuthPort {
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
    deleteUser(userId: string): Promise<BackendCompatResponse<{ success: true }>>
  }
}

export interface BackendCompatClient<TDatabase = Database> {
  auth: BackendCompatAuthPort
  from(table: TableName | string): BackendQueryBuilder<any>
  rpc(name: string, params?: Record<string, unknown>): BackendRpcBuilder<any>
}

export interface CreateBackendCompatClientOptions
  extends Partial<ButterbaseHttpClientConfig> {
  accessToken?: string
  authMode?: AuthMode
}

export interface QueryFilter {
  column: string
  operator: string
  value: unknown
}

export interface QueryOrder {
  column: string
  ascending: boolean
}

export interface SelectOptions {
  count?: 'exact' | null
  head?: boolean
}
