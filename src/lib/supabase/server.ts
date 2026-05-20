import { createServerBackendClient } from '@/lib/backend/server'

/**
 * Creates a request-scoped Butterbase client for Server Components and routes.
 * The legacy module path is kept during the cutover so existing route handlers
 * can migrate without changing imports in the same patch.
 */
export async function createServerSupabaseClient() {
  return createServerBackendClient()
}
