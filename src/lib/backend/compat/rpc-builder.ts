import {
  ButterbaseRequestError,
  type ButterbaseHttpClient,
} from '../butterbase/http-client'
import { toCompatError } from './errors'
import { mapRpcToFunction, normalizeRpcResult } from './function-mapping'
import type {
  AuthMode,
  BackendCompatResponse,
  QueryResponseMode,
} from './types'

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
