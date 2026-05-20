import { createAdminBackendClient } from '@/lib/backend/server'

/**
 * Creates the server-only Butterbase client with service-key privileges.
 * The legacy module path is kept during the cutover so existing route handlers
 * can migrate without changing imports in the same patch.
 */
export function createAdminClient() {
  return createAdminBackendClient()
}
