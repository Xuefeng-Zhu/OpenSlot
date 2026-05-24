/**
 * Tenant-facing webhook event names supported by endpoint subscriptions.
 */
export const webhookEventTypes = [
  '*',
  'booking.confirmed',
  'booking.cancelled',
  'booking.rescheduled',
] as const

export type WebhookEventType = (typeof webhookEventTypes)[number]

export const webhookEventOptions = [
  { value: 'booking.confirmed', label: 'Confirmed' },
  { value: 'booking.cancelled', label: 'Cancelled' },
  { value: 'booking.rescheduled', label: 'Rescheduled' },
  { value: '*', label: 'All' },
] as const satisfies ReadonlyArray<{
  value: WebhookEventType
  label: string
}>

export function webhookEventLabel(eventType: string): string {
  return (
    webhookEventOptions.find((option) => option.value === eventType)?.label ??
    eventType
  )
}
