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
  const hasMissingFunctionSignal =
    message.includes('function not found') ||
    detailText.includes('function not found') ||
    message.includes('missing function') ||
    detailText.includes('missing function') ||
    message.includes('function route not found') ||
    detailText.includes('function route not found') ||
    message.includes('function is not deployed') ||
    detailText.includes('function is not deployed')

  if (hasMissingFunctionSignal) {
    return true
  }

  return (
    error.status === 404 &&
    message.includes('butterbase request failed with 404')
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
