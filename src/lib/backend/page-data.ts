import type {
  BackendCompatError,
  BackendCompatResponse,
  BackendCompatUser,
} from '@/lib/backend/compat/query-client'

interface PageAuthResult {
  data: { user: BackendCompatUser | null }
  error: BackendCompatError | null
}

/** Returns true only for the backend's explicit zero-row response code. */
export function isMissingRowError(
  error: BackendCompatError | null | undefined
): boolean {
  return error?.code === 'PGRST116'
}

/**
 * Resolves a page authentication response without treating provider outages as
 * signed-out sessions. Callers redirect a null result to the login page.
 */
export function pageUserOrNull(result: PageAuthResult): BackendCompatUser | null {
  if (result.error) {
    if (result.error.status === 401) return null
    throw new Error('Failed to verify the authenticated session')
  }

  return result.data.user
}

/**
 * Resolves an optional single-row query. Only an explicit zero-row response is
 * absence; endpoint, permission, and provider errors continue to an error
 * boundary instead of masquerading as missing data.
 */
export function optionalPageRow<T>(
  result: BackendCompatResponse<T>,
  label: string
): T | null {
  if (result.error) {
    if (isMissingRowError(result.error)) return null
    throw new Error(`Failed to load ${label}`)
  }

  return result.data
}

/** Resolves a successful collection query while preserving legitimate emptiness. */
export function pageCollection<T>(
  result: BackendCompatResponse<T[]>,
  label: string
): T[] {
  if (result.error) {
    throw new Error(`Failed to load ${label}`)
  }

  return result.data ?? []
}
