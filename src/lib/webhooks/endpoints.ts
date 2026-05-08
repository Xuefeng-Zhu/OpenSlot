import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/lib/types/database'

export interface WebhookEndpointSummary {
  id: string
  url: string
  description: string
  subscribedEvents: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type SafeWebhookEndpointRow = Pick<
  Tables<'webhook_endpoints'>,
  | 'id'
  | 'url'
  | 'description'
  | 'subscribed_events'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
>

export async function listWebhookEndpointSummaries(
  adminClient: SupabaseClient<Database>,
  profileId: string
): Promise<WebhookEndpointSummary[]> {
  const { data, error } = await adminClient
    .from('webhook_endpoints')
    .select('id, url, description, subscribed_events, is_active, created_at, updated_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load webhook endpoints: ${error.message}`)
  }

  return ((data ?? []) as SafeWebhookEndpointRow[]).map(
    toWebhookEndpointSummary
  )
}

export function toWebhookEndpointSummary(
  endpoint: SafeWebhookEndpointRow
): WebhookEndpointSummary {
  return {
    id: endpoint.id,
    url: endpoint.url,
    description: endpoint.description,
    subscribedEvents: endpoint.subscribed_events,
    isActive: endpoint.is_active,
    createdAt: endpoint.created_at,
    updatedAt: endpoint.updated_at,
  }
}
