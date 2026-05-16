import type { CalendarProvider } from './oauth'

export const videoProviders = ['google_meet', 'microsoft_teams'] as const

export type VideoProvider = (typeof videoProviders)[number]

export interface VideoProviderMetadata {
  id: VideoProvider
  label: string
  calendarProvider: CalendarProvider
}

export const videoProviderMetadata = {
  google_meet: {
    id: 'google_meet',
    label: 'Google Meet',
    calendarProvider: 'google',
  },
  microsoft_teams: {
    id: 'microsoft_teams',
    label: 'Microsoft Teams',
    calendarProvider: 'microsoft',
  },
} as const satisfies Record<VideoProvider, VideoProviderMetadata>

export const videoProviderOptions = videoProviders.map(
  (provider) => videoProviderMetadata[provider]
)

export const defaultVideoProvider = videoProviders[0]

export type VideoProviderReadinessStatus =
  | 'missing_connection'
  | 'connection_attention'
  | 'write_calendar_missing'
  | 'ready'

export interface VideoProviderReadiness {
  provider: VideoProvider
  label: string
  calendarProvider: CalendarProvider
  ready: boolean
  status: VideoProviderReadinessStatus
  message: string
  badgeLabel: string
  description: string
}

interface CalendarConnectionForReadiness {
  provider: string
  accountEmail?: string | null
  status: string
  calendars: Array<{
    useForWrites: boolean
  }>
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(videoProviderMetadata, value)
  )
}

export function parseVideoProvider(
  value: string | null | undefined
): VideoProvider | null {
  return isVideoProvider(value) ? value : null
}

export function getVideoProviderMetadata(
  provider: VideoProvider
): VideoProviderMetadata
export function getVideoProviderMetadata(
  provider: string | null | undefined
): VideoProviderMetadata | null
export function getVideoProviderMetadata(
  provider: string | null | undefined
): VideoProviderMetadata | null {
  const parsedProvider = parseVideoProvider(provider)
  return parsedProvider ? videoProviderMetadata[parsedProvider] : null
}

export function videoProviderLabel(provider: VideoProvider): string
export function videoProviderLabel(
  provider: string | null | undefined
): string | null
export function videoProviderLabel(
  provider: string | null | undefined
): string | null {
  return getVideoProviderMetadata(provider)?.label ?? null
}

export function calendarProviderForVideoProvider(
  provider: VideoProvider
): CalendarProvider {
  return videoProviderMetadata[provider].calendarProvider
}

export function getVideoProviderReadiness(
  provider: VideoProvider,
  connections: CalendarConnectionForReadiness[]
): VideoProviderReadiness {
  const metadata = videoProviderMetadata[provider]
  const connection = connections.find(
    (item) => item.provider === metadata.calendarProvider
  )

  if (!connection) {
    return {
      provider,
      label: metadata.label,
      calendarProvider: metadata.calendarProvider,
      ready: false,
      status: 'missing_connection',
      message: `${metadata.label} needs a connected calendar account before links can be generated.`,
      badgeLabel: 'Setup needed',
      description: `${metadata.label} links need a connected calendar account.`,
    }
  }

  const accountLabel = connection.accountEmail ?? 'the connected account'

  if (connection.status !== 'active') {
    return {
      provider,
      label: metadata.label,
      calendarProvider: metadata.calendarProvider,
      ready: false,
      status: 'connection_attention',
      message: `${metadata.label} calendar connection needs attention before links can be generated.`,
      badgeLabel: 'Needs attention',
      description: `Reconnect ${accountLabel} before OpenSlot can generate ${metadata.label} links.`,
    }
  }

  if (!connection.calendars.some((calendar) => calendar.useForWrites)) {
    return {
      provider,
      label: metadata.label,
      calendarProvider: metadata.calendarProvider,
      ready: false,
      status: 'write_calendar_missing',
      message: `${metadata.label} needs a writable calendar selected for booking writes.`,
      badgeLabel: 'Write calendar off',
      description: `Enable a writable calendar on ${accountLabel} before OpenSlot can generate ${metadata.label} links.`,
    }
  }

  return {
    provider,
    label: metadata.label,
    calendarProvider: metadata.calendarProvider,
    ready: true,
    status: 'ready',
    message: `${metadata.label} is ready to generate links for new bookings.`,
    badgeLabel: 'Ready',
    description: `${metadata.label} links can be generated for new bookings.`,
  }
}
