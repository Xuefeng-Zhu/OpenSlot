import type { ButterbaseHttpClient } from '../butterbase/http-client'
import { toCompatError } from './errors'
import type { BackendCompatResponse } from './types'

export async function requestAsCompat<TResponse>(
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

export function mapCompatResponse<TInput, TOutput>(
  response: BackendCompatResponse<TInput>,
  mapper: (data: TInput) => TOutput
): BackendCompatResponse<TOutput> {
  if (response.error || response.data === null) {
    return { data: null, error: response.error }
  }

  return { data: mapper(response.data), error: null }
}
