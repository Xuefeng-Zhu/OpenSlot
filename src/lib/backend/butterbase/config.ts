export interface ButterbaseBackendConfig {
  appId: string
  apiUrl: string
  apiKey?: string
  accessToken?: string
  fetchImpl?: typeof fetch
}

export function resolveButterbaseConfig(
  overrides: Partial<ButterbaseBackendConfig> = {}
): ButterbaseBackendConfig {
  const appId =
    overrides.appId ?? process.env.NEXT_PUBLIC_BUTTERBASE_APP_ID ?? ''
  const apiUrl =
    overrides.apiUrl ??
    process.env.NEXT_PUBLIC_BUTTERBASE_API_URL ??
    'https://api.butterbase.ai'

  if (!appId) {
    throw new Error('NEXT_PUBLIC_BUTTERBASE_APP_ID is required')
  }

  return {
    appId,
    apiUrl,
    apiKey: overrides.apiKey ?? process.env.BUTTERBASE_API_KEY,
    accessToken: overrides.accessToken,
    fetchImpl: overrides.fetchImpl,
  }
}
