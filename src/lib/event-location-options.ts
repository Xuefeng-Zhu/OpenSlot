import {
  defaultVideoProvider,
  videoProviderOptions,
  type VideoProvider,
} from '@/lib/calendar/video-providers'
import type {
  EventLocationType,
  EventTypeFormValues,
} from '@/lib/validations/event-type'

const eventLocationTypes = [
  'online',
  'phone',
  'in_person',
  'custom',
  'video_provider',
] as const satisfies readonly EventLocationType[]

const manualEventLocationOptions = [
  { value: 'custom', label: 'Custom link' },
  { value: 'phone', label: 'Phone' },
  { value: 'in_person', label: 'In Person' },
] as const satisfies ReadonlyArray<{
  value: EventLocationType
  label: string
}>

export const eventLocationSelectOptions = [
  ...manualEventLocationOptions,
  ...videoProviderOptions.map((provider) => ({
    value: provider.id,
    label: provider.label,
  })),
  { value: 'online', label: 'Online (manual)' },
] as const satisfies ReadonlyArray<{
  value: EventLocationType | VideoProvider
  label: string
}>

export function isEventLocationType(
  value: string
): value is EventLocationType {
  return eventLocationTypes.includes(value as EventLocationType)
}

export function eventLocationSelectValue(
  locationType: EventTypeFormValues['location_type'],
  videoProvider: EventTypeFormValues['video_provider']
) {
  return locationType === 'video_provider'
    ? videoProvider ?? defaultVideoProvider
    : locationType
}

export function eventLocationPlaceholder(locationType: EventLocationType) {
  if (locationType === 'phone') return 'e.g. +1 555 123 4567'
  if (locationType === 'in_person') return 'e.g. 123 Market Street'
  if (locationType === 'custom') return 'e.g. https://example.com/meeting'
  return 'e.g. Online meeting details'
}
