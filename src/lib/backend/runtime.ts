import { createButterbaseBackend } from './butterbase/adapter'

export function createBackendRuntime(options: { accessToken?: string } = {}) {
  return createButterbaseBackend({
    accessToken: options.accessToken,
  })
}
