import type { BackendCompatError } from './types'

/**
 * Returns true when a Butterbase function call failed before user code could
 * run, so the app can use its non-transactional compatibility implementation.
 */
export function shouldUseFunctionFallback(
  error: BackendCompatError | null | undefined
) {
  if (!error) return false

  const detailText = stringifyDetails(error.details).toLowerCase()
  const message = error.message.toLowerCase()

  if (
    error.status === 404 &&
    (message.includes('function not found') ||
      detailText.includes('function not found') ||
      message.includes('butterbase request failed with 404'))
  ) {
    return true
  }

  // Some Butterbase deployments report unavailable function routing as a
  // gateway response without a structured body.
  return (
    (error.status === 501 || error.status === 502 || error.status === 503) &&
    !error.code
  )
}

function stringifyDetails(details: unknown) {
  if (!details) return ''
  if (typeof details === 'string') return details

  try {
    return JSON.stringify(details)
  } catch {
    return ''
  }
}
