import { ButterbaseRequestError } from '../butterbase/http-client'
import type { BackendError } from '../ports'
import type { BackendCompatError } from './types'

export function toCompatError(error: unknown): BackendCompatError {
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
