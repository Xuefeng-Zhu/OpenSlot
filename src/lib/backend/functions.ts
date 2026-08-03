import type { BackendFunctionName } from './ports'

export const backendFunctionSlugs = {
  createSlotHold: 'create-slot-hold',
  confirmBooking: 'confirm-booking',
  cancelBooking: 'cancel-booking',
  rescheduleBooking: 'reschedule-booking',
  claimOutboxEvents: 'claim-outbox-events',
  claimWebhookDeliveries: 'claim-webhook-deliveries',
  consumePublicRateLimit: 'consume-public-rate-limit',
  expireStaleSlotHolds: 'expire-stale-slot-holds',
  refreshProviderToken: 'refresh-provider-token',
  saveAvailability: 'save-availability',
  saveDashboardPreferences: 'save-dashboard-preferences',
} as const satisfies Record<BackendFunctionName, string>
