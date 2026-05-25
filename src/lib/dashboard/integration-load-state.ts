import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import {
  listCalendarConnectionSummaries,
  type CalendarConnectionSummary,
} from '@/lib/calendar/connections'
import type { Database } from '@/lib/types/database'
import {
  listMcpTokenSummaries,
  type McpTokenSummary,
} from '@/lib/mcp/tokens'
import {
  listWebhookEndpointSummaries,
  type WebhookEndpointSummary,
} from '@/lib/webhooks/endpoints'

export interface DashboardIntegrationLoadResult<T> {
  data: T[]
  loadFailed: boolean
}

/**
 * Loads dashboard integration summaries while preserving whether the load
 * failed. Callers can render a warning instead of making failures look like an
 * empty configured state.
 */
export async function loadDashboardIntegrationSummaries<T>(
  label: string,
  load: () => Promise<T[]>
): Promise<DashboardIntegrationLoadResult<T>> {
  try {
    return { data: await load(), loadFailed: false }
  } catch (error) {
    console.warn(`Error loading ${label}:`, error)
    return { data: [], loadFailed: true }
  }
}

export function loadDashboardCalendarConnections(
  adminClient: BackendCompatClient<Database>,
  profileId: string
): Promise<DashboardIntegrationLoadResult<CalendarConnectionSummary>> {
  return loadDashboardIntegrationSummaries('calendar connections', () =>
    listCalendarConnectionSummaries(adminClient, profileId)
  )
}

export function loadDashboardWebhookEndpoints(
  adminClient: BackendCompatClient<Database>,
  profileId: string
): Promise<DashboardIntegrationLoadResult<WebhookEndpointSummary>> {
  return loadDashboardIntegrationSummaries('webhook endpoints', () =>
    listWebhookEndpointSummaries(adminClient, profileId)
  )
}

export function loadDashboardMcpTokens(
  adminClient: BackendCompatClient<Database>,
  profileId: string
): Promise<DashboardIntegrationLoadResult<McpTokenSummary>> {
  return loadDashboardIntegrationSummaries('MCP tokens', () =>
    listMcpTokenSummaries(adminClient, profileId)
  )
}
