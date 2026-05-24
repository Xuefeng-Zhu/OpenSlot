import type { ButterbaseHttpClient } from '../butterbase/http-client'
import type { AuthMode } from './types'

export async function hydrateRelations(
  httpClient: ButterbaseHttpClient,
  authMode: AuthMode,
  selected: string,
  rows: unknown[]
) {
  const relations = relationSelections(selected)
  if (!relations.some((relation) => relation.name === 'event_types')) return

  const eventTypeIds = Array.from(
    new Set(
      rows
        .map((row) => (row as Record<string, unknown>).event_type_id)
        .filter((value): value is string => typeof value === 'string')
    )
  )

  if (eventTypeIds.length === 0) return

  const params = new URLSearchParams()
  params.set('id', `in.(${eventTypeIds.join(',')})`)
  const eventTypeRelation = relations.find(
    (relation) => relation.name === 'event_types'
  )
  if (eventTypeRelation?.columns) {
    params.set('select', `id,${eventTypeRelation.columns}`)
  }

  const eventTypes = await httpClient.request<Record<string, unknown>[]>({
    path: `/v1/${httpClient.appId}/event_types?${params.toString()}`,
    auth: authMode,
  })
  const eventTypesById = new Map(
    eventTypes.map((eventType) => [String(eventType.id), eventType])
  )

  for (const row of rows) {
    const record = row as Record<string, unknown>
    const eventTypeId = record.event_type_id
    record.event_types =
      typeof eventTypeId === 'string'
        ? eventTypesById.get(eventTypeId) ?? null
        : null
  }
}

export function baseColumns(selected: string) {
  return selected
    .replace(/\w+\([^)]*\)/g, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(',')
}

function relationSelections(selected: string) {
  const relations: Array<{ name: string; columns: string }> = []
  const matcher = /(\w+)\(([^)]*)\)/g
  let match = matcher.exec(selected)

  while (match) {
    relations.push({
      name: match[1],
      columns: match[2].trim(),
    })
    match = matcher.exec(selected)
  }

  return relations
}
