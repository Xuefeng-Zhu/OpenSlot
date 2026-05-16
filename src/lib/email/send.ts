/**
 * Email send functions for booking notifications.
 *
 * Emails are logged to the console unless EMAIL_PROVIDER is configured.
 *
 * Delivery failures throw so outbox processing can retry failed work.
 */

import type { EmailProvider, EmailPayload } from './provider'
import { ConsoleEmailProvider, MailerooEmailProvider, ResendEmailProvider } from './provider'
import {
  bookingConfirmationGuestTemplate,
  bookingNotificationHostTemplate,
  bookingReminderTemplate,
  cancellationTemplate,
} from './templates'
import { videoProviderLabel } from '@/lib/calendar/video-providers'
import type { BookingAnswerSummary } from '@/lib/validations/invitee-questions'

/**
 * Booking details needed to compose email notifications.
 */
export interface BookingDetails {
  bookingId: string
  eventTitle: string
  startAt: string // ISO 8601 UTC
  endAt: string // ISO 8601 UTC
  guestName: string
  guestEmail: string
  guestTimezone: string
  hostName: string
  hostEmail: string
  locationType?: string
  locationValue?: string
  conferenceProvider?: string | null
  conferenceUrl?: string | null
  conferenceStatus?: string
  bookingAnswers?: BookingAnswerSummary[]
  cancellationToken?: string
  rescheduleToken?: string
}

/**
 * Returns the configured email provider.
 * Uses the configured provider when EMAIL_PROVIDER is set.
 * Defaults to console so local and unconfigured production environments do not
 * accidentally send mail.
 */
export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_PROVIDER === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    if (!from) {
      throw new Error('EMAIL_FROM is not configured')
    }

    return new ResendEmailProvider(apiKey, from)
  }

  if (process.env.EMAIL_PROVIDER === 'maileroo') {
    const apiKey = process.env.MAILEROO_API_KEY
    const from = process.env.EMAIL_FROM

    if (!apiKey) {
      throw new Error('MAILEROO_API_KEY is not configured')
    }

    if (!from) {
      throw new Error('EMAIL_FROM is not configured')
    }

    return new MailerooEmailProvider(apiKey, from)
  }

  return new ConsoleEmailProvider()
}

/**
 * Formats a UTC ISO timestamp into a human-readable date and time string
 * for the given timezone.
 */
function formatBookingDateTime(isoStart: string, isoEnd: string, timezone: string): { date: string; time: string } {
  try {
    const start = new Date(isoStart)
    const end = new Date(isoEnd)

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    })

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })

    return {
      date: dateFormatter.format(start),
      time: `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`,
    }
  } catch {
    // Fallback if timezone is invalid
    return {
      date: new Date(isoStart).toDateString(),
      time: `${new Date(isoStart).toTimeString().slice(0, 5)} - ${new Date(isoEnd).toTimeString().slice(0, 5)}`,
    }
  }
}

/**
 * Builds the cancellation URL for a booking.
 */
function buildCancellationUrl(cancellationToken: string | undefined): string | undefined {
  if (!cancellationToken) return undefined
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/booking/cancel/${cancellationToken}`
}

function buildRescheduleUrl(rescheduleToken: string | undefined): string | undefined {
  if (!rescheduleToken) return undefined
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/booking/reschedule/${rescheduleToken}`
}

function bookingLocationLabel(booking: BookingDetails): string | undefined {
  const generatedVideoLabel = videoProviderLabel(booking.conferenceProvider)
  if (generatedVideoLabel) return generatedVideoLabel

  if (booking.locationValue) {
    return booking.locationValue
  }

  if (booking.locationType === 'phone') {
    return 'Phone call'
  }

  if (booking.locationType === 'in_person') {
    return 'In person'
  }

  if (booking.locationType === 'online') {
    return 'Online'
  }

  return undefined
}

function emailErrorMessage(context: string, error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${context}: ${error.message}`
  }

  if (typeof error === 'string' && error.length > 0) {
    return `${context}: ${error}`
  }

  return `${context}: unknown email provider error`
}

async function deliverEmail(payload: EmailPayload, failureContext: string): Promise<void> {
  try {
    const provider = getEmailProvider()
    const result = await provider.send(payload)

    if (!result.success) {
      throw new Error(result.error ?? 'Email provider returned an unsuccessful response')
    }
  } catch (error) {
    throw new Error(emailErrorMessage(failureContext, error))
  }
}

/**
 * Sends a booking confirmation email to the guest.
 * Throws on provider failures so the outbox worker can retry delivery.
 */
export async function sendBookingConfirmationToGuest(booking: BookingDetails): Promise<void> {
  const { date, time } = formatBookingDateTime(booking.startAt, booking.endAt, booking.guestTimezone)
  const cancellationUrl = buildCancellationUrl(booking.cancellationToken)
  const rescheduleUrl = buildRescheduleUrl(booking.rescheduleToken)
  const locationLabel = bookingLocationLabel(booking)

  const { subject, html, text } = bookingConfirmationGuestTemplate({
    eventTitle: booking.eventTitle,
    date,
    time,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    hostName: booking.hostName,
    timezone: booking.guestTimezone,
    locationLabel,
    conferenceUrl: booking.conferenceUrl ?? undefined,
    cancellationUrl,
    rescheduleUrl,
  })

  const payload: EmailPayload = {
    to: booking.guestEmail,
    subject,
    html,
    text,
    idempotencyKey: `booking-confirmation:${booking.bookingId}:guest`,
  }

  await deliverEmail(payload, 'Booking confirmation email to guest failed')
}

/**
 * Sends a booking notification email to the host.
 * Throws on provider failures so the outbox worker can retry delivery.
 */
export async function sendBookingNotificationToHost(booking: BookingDetails): Promise<void> {
  const { date, time } = formatBookingDateTime(booking.startAt, booking.endAt, booking.guestTimezone)
  const locationLabel = bookingLocationLabel(booking)

  const { subject, html, text } = bookingNotificationHostTemplate({
    eventTitle: booking.eventTitle,
    date,
    time,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    hostName: booking.hostName,
    timezone: booking.guestTimezone,
    locationLabel,
    conferenceUrl: booking.conferenceUrl ?? undefined,
    bookingAnswers: booking.bookingAnswers,
  })

  const payload: EmailPayload = {
    to: booking.hostEmail,
    subject,
    html,
    text,
    idempotencyKey: `booking-notification:${booking.bookingId}:host`,
  }

  await deliverEmail(payload, 'Booking notification email to host failed')
}

/**
 * Sends a cancellation email to either the guest or the host.
 * Throws on provider failures so the outbox worker can retry delivery.
 */
export async function sendCancellationEmail(
  booking: BookingDetails,
  recipient: 'guest' | 'host'
): Promise<void> {
  const toEmail = recipient === 'guest' ? booking.guestEmail : booking.hostEmail
  const { date, time } = formatBookingDateTime(booking.startAt, booking.endAt, booking.guestTimezone)

  const { subject, html, text } = cancellationTemplate(
    {
      eventTitle: booking.eventTitle,
      date,
      time,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      hostName: booking.hostName,
      timezone: booking.guestTimezone,
    },
    recipient
  )

  const payload: EmailPayload = {
    to: toEmail,
    subject,
    html,
    text,
    idempotencyKey: `booking-cancellation:${booking.bookingId}:${recipient}`,
  }

  await deliverEmail(payload, `Cancellation email to ${recipient} failed`)
}

/**
 * Sends a pre-meeting reminder to either the guest or the host.
 * Throws on provider failures so the outbox worker can retry delivery.
 */
export async function sendBookingReminderEmail(
  booking: BookingDetails,
  recipient: 'guest' | 'host',
  minutesBefore: number
): Promise<void> {
  const toEmail = recipient === 'guest' ? booking.guestEmail : booking.hostEmail
  const { date, time } = formatBookingDateTime(booking.startAt, booking.endAt, booking.guestTimezone)
  const cancellationUrl = buildCancellationUrl(booking.cancellationToken)
  const rescheduleUrl = buildRescheduleUrl(booking.rescheduleToken)

  const { subject, html, text } = bookingReminderTemplate(
    {
      eventTitle: booking.eventTitle,
      date,
      time,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      hostName: booking.hostName,
      timezone: booking.guestTimezone,
      cancellationUrl,
      rescheduleUrl,
    },
    recipient,
    minutesBefore
  )

  const payload: EmailPayload = {
    to: toEmail,
    subject,
    html,
    text,
    idempotencyKey: `booking-reminder:${booking.bookingId}:${recipient}:${minutesBefore}`,
  }

  await deliverEmail(payload, `Reminder email to ${recipient} failed`)
}
