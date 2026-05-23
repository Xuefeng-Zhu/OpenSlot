import { backendFailure, backendSuccess, type BackendResult } from '../ports'

export class ButterbaseRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly remediation?: string,
    readonly body?: unknown
  ) {
    super(message)
    this.name = 'ButterbaseRequestError'
  }
}

export interface ButterbaseHttpClientConfig {
  appId: string
  apiUrl: string
  apiKey?: string
  functionSecret?: string
  accessToken?: string
  fetchImpl?: typeof fetch
}

export interface ButterbaseRequestOptions<TBody = unknown> {
  method?: string
  path: string
  body?: TBody
  headers?: Record<string, string>
  auth?: 'none' | 'service' | 'user'
  accessToken?: string
}

export class ButterbaseHttpClient {
  readonly appId: string
  private readonly apiUrl: string
  private readonly apiKey?: string
  private readonly functionSecret?: string
  private readonly accessToken?: string
  private readonly fetchImpl: typeof fetch

  constructor(config: ButterbaseHttpClientConfig) {
    this.appId = config.appId
    this.apiUrl = config.apiUrl.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.functionSecret = config.functionSecret
    this.accessToken = config.accessToken
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  async result<TResponse, TBody = unknown>(
    options: ButterbaseRequestOptions<TBody>
  ): Promise<BackendResult<TResponse>> {
    try {
      return backendSuccess(await this.request<TResponse, TBody>(options))
    } catch (error) {
      if (error instanceof ButterbaseRequestError) {
        return backendFailure({
          message: error.message,
          code: error.code,
          status: error.status,
          remediation: error.remediation,
          cause: error.body,
        })
      }

      return backendFailure({
        message: error instanceof Error ? error.message : 'Butterbase request failed',
        cause: error,
      })
    }
  }

  async request<TResponse, TBody = unknown>({
    method = 'GET',
    path,
    body,
    headers = {},
    auth = 'service',
    accessToken,
  }: ButterbaseRequestOptions<TBody>): Promise<TResponse> {
    const requestHeaders = new Headers({
      Accept: 'application/json',
      ...headers,
    })

    if (body !== undefined) {
      requestHeaders.set('Content-Type', 'application/json')
    }

    const token = accessToken ?? this.tokenForAuth(auth)
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`)
    }

    const response = await this.fetchImpl(this.url(path), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const parsed = await parseResponseBody(response)

    if (!response.ok) {
      const errorInfo = normalizeButterbaseError(parsed)
      throw new ButterbaseRequestError(
        errorInfo.message || `Butterbase request failed with ${response.status}`,
        response.status,
        errorInfo.code,
        errorInfo.remediation,
        parsed
      )
    }

    return parsed as TResponse
  }

  functionAccessToken(): string | undefined {
    return this.functionSecret ?? this.apiKey
  }

  private url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${this.apiUrl}${normalizedPath}`
  }

  private tokenForAuth(auth: ButterbaseRequestOptions['auth']): string | undefined {
    if (auth === 'none') return undefined
    if (auth === 'user') return this.accessToken
    return this.apiKey
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function normalizeButterbaseError(body: unknown): {
  message?: string
  code?: string
  remediation?: string
} {
  if (!body || typeof body !== 'object') return {}

  const record = body as Record<string, unknown>
  const nested = record.error

  if (nested && typeof nested === 'object') {
    const error = nested as Record<string, unknown>
    return {
      message: typeof error.message === 'string' ? error.message : undefined,
      code: typeof error.code === 'string' ? error.code : undefined,
      remediation:
        typeof error.remediation === 'string' ? error.remediation : undefined,
    }
  }

  return {
    message: typeof record.message === 'string' ? record.message : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
    remediation:
      typeof record.remediation === 'string' ? record.remediation : undefined,
  }
}
