import type {
  BackendCompatError,
  BackendCompatResponse,
  BackendCompatSession,
  BackendCompatUser,
} from '@/lib/backend/compat/query-client'
import { setBrowserAuthSessionPersistence } from './auth-cookie-persistence'

type CreateClientOptions = {
  keepSignedIn?: boolean
}

type BrowserQueryOperation = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

type BrowserQueryRequest = {
  table: string
  operation: BrowserQueryOperation
  filters: Array<{ column: string; operator: string; value: unknown }>
  orders: Array<{ column: string; ascending: boolean }>
  selected: string
  selectOptions: { count?: 'exact' | null; head?: boolean }
  responseMode: 'many' | 'single' | 'maybeSingle'
  limitCount?: number
  offsetCount?: number
  payload?: unknown
  upsertOptions?: { onConflict?: string }
}

/**
 * Creates a browser-safe backend client. Auth and data calls go through
 * OpenSlot route handlers so Butterbase access tokens stay in HTTP-only cookies.
 */
export function createClient(options: CreateClientOptions = {}) {
  return {
    auth: {
      async signInWithPassword(input: { email: string; password: string }) {
        if (options.keepSignedIn !== undefined) {
          setBrowserAuthSessionPersistence(options.keepSignedIn)
        }

        return postAuth<BackendCompatSession>('/api/auth/login', {
          ...input,
          keepSignedIn: options.keepSignedIn,
        })
      },
      async signUp(input: {
        email: string
        password: string
        options?: { data?: { full_name?: string; name?: string } }
      }) {
        const displayName =
          input.options?.data?.full_name ?? input.options?.data?.name

        return postAuth<{
          user: BackendCompatUser | null
          requiresLogin?: boolean
        }>(
          '/api/auth/signup',
          {
            email: input.email,
            password: input.password,
            displayName,
            keepSignedIn: options.keepSignedIn,
          }
        )
      },
      async updateUser(input: { email?: string; password?: string }) {
        return patchAuth<{ user: BackendCompatUser | null }>(
          '/api/auth/update',
          input
        )
      },
      async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
        return postAuth<{ success: true }>('/api/auth/password-reset', {
          email,
        })
      },
      async exchangeCodeForSession(code: string) {
        const response = await fetch('/api/auth/exchange-code', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        })
        const body = await response.json().catch(() => ({}))

        if (!response.ok || body.success === false) {
          return {
            data: null,
            error: responseError(body, response.status),
          }
        }

        return {
          data: body.session ?? null,
          error: null,
        }
      },
      async getUser() {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({}))

        return {
          data: { user: data.user ?? null },
          error: response.ok ? null : responseError(data, response.status),
        }
      },
      async getSession() {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({}))

        return {
          data: { session: data.session ?? null },
          error: response.ok ? null : responseError(data, response.status),
        }
      },
      async signOut() {
        return postAuth<{ success: true }>('/api/auth/logout', {})
      },
    },
    from(table: string) {
      return new BrowserQueryBuilder(table)
    },
  }
}

class BrowserQueryBuilder<TData = unknown>
  implements PromiseLike<BackendCompatResponse<TData>>
{
  private request: BrowserQueryRequest

  constructor(table: string) {
    this.request = {
      table,
      operation: 'select',
      filters: [],
      orders: [],
      selected: '*',
      selectOptions: {},
      responseMode: 'many',
    }
  }

  select<TResult = unknown>(
    columns = '*',
    options: BrowserQueryRequest['selectOptions'] = {}
  ): BrowserQueryBuilder<TResult> {
    this.request.selected = columns
    this.request.selectOptions = options
    return this as unknown as BrowserQueryBuilder<TResult>
  }

  insert<TResult = unknown>(payload: unknown): BrowserQueryBuilder<TResult> {
    this.request.operation = 'insert'
    this.request.payload = payload
    return this as unknown as BrowserQueryBuilder<TResult>
  }

  update<TResult = unknown>(payload: unknown): BrowserQueryBuilder<TResult> {
    this.request.operation = 'update'
    this.request.payload = payload
    return this as unknown as BrowserQueryBuilder<TResult>
  }

  upsert<TResult = unknown>(
    payload: unknown,
    options: { onConflict?: string } = {}
  ): BrowserQueryBuilder<TResult> {
    this.request.operation = 'upsert'
    this.request.payload = payload
    this.request.upsertOptions = options
    return this as unknown as BrowserQueryBuilder<TResult>
  }

  delete<TResult = unknown>(): BrowserQueryBuilder<TResult> {
    this.request.operation = 'delete'
    return this as unknown as BrowserQueryBuilder<TResult>
  }

  eq(column: string, value: unknown) {
    return this.addFilter(column, 'eq', value)
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

  is(column: string, value: unknown) {
    return this.addFilter(column, 'is', value)
  }

  in(column: string, value: unknown[]) {
    return this.addFilter(column, 'in', value)
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.request.orders.push({
      column,
      ascending: options.ascending ?? true,
    })
    return this
  }

  limit(count: number) {
    this.request.limitCount = count
    return this
  }

  offset(count: number) {
    this.request.offsetCount = count
    return this
  }

  single<TResult = TData>(): BrowserQueryBuilder<TResult> {
    this.request.responseMode = 'single'
    return this as unknown as BrowserQueryBuilder<TResult>
  }

  maybeSingle<TResult = TData>(): BrowserQueryBuilder<TResult | null> {
    this.request.responseMode = 'maybeSingle'
    return this as unknown as BrowserQueryBuilder<TResult | null>
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
    this.request.filters.push({ column, operator, value })
    return this
  }

  private async execute(): Promise<BackendCompatResponse<TData>> {
    const response = await fetch('/api/backend/query', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.request),
    })
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        data: null,
        error: responseError(body, response.status),
        count: null,
      }
    }

    return body
  }
}

async function postAuth<TResponse>(path: string, body: unknown) {
  return authFetch<TResponse>('POST', path, body)
}

async function patchAuth<TResponse>(path: string, body: unknown) {
  return authFetch<TResponse>('PATCH', path, body)
}

async function authFetch<TResponse>(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown
): Promise<BackendCompatResponse<TResponse>> {
  const response = await fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.success === false) {
    return {
      data: null,
      error: responseError(data, response.status),
    }
  }

  return { data, error: null }
}

function responseError(body: unknown, status: number): BackendCompatError {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const nestedError =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : null
  const message =
    typeof record.error === 'string'
      ? record.error
      : typeof nestedError?.message === 'string'
        ? nestedError.message
        : typeof record.message === 'string'
          ? record.message
          : `Request failed with status ${status}`
  const code =
    typeof nestedError?.code === 'string'
      ? nestedError.code
      : typeof record.code === 'string'
        ? record.code
        : undefined

  return {
    message,
    code,
    status,
    details: nestedError?.details ?? record.details,
  }
}
