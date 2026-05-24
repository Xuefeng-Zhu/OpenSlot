import type { Database } from '@/lib/types/database'
import { resolveButterbaseConfig } from '../butterbase/config'
import { ButterbaseHttpClient } from '../butterbase/http-client'
import { BackendCompatAuth } from './auth'
import { BackendQueryBuilder } from './query-builder'
import { BackendRpcBuilder } from './rpc-builder'
import type {
  AuthMode,
  BackendCompatClient,
  CreateBackendCompatClientOptions,
} from './types'

export type {
  BackendCompatClient,
  BackendCompatError,
  BackendCompatResponse,
  BackendCompatSession,
  BackendCompatUser,
} from './types'
export { BackendQueryBuilder } from './query-builder'
export { BackendRpcBuilder } from './rpc-builder'

export function createBackendCompatClient<TDatabase = Database>(
  options: CreateBackendCompatClientOptions = {}
): BackendCompatClient<TDatabase> {
  const config = resolveButterbaseConfig(options)
  const httpClient = new ButterbaseHttpClient({
    ...config,
    accessToken: options.accessToken,
    fetchImpl: options.fetchImpl,
  })
  const authMode: AuthMode =
    options.authMode ?? (options.accessToken ? 'user' : 'service')

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
