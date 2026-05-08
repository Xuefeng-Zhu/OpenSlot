/**
 * Email send functions for booking notifications.
 *
 * Emails are logged to the console unless EMAIL_PROVIDER is configured.
 *
 * All functions are fire-and-forget: errors are caught and logged, never thrown.
 */

import type { EmailProvider, EmailPayload } from './provider'
import { ConsoleEmailProvider, ResendEmailProvider } from './provider'
import {
  bookingConfirmationGuestTemplate,
  bookingNotificationHostTemplate,
  cancellationTemplate,
} from './templates'

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

/**
 * Sends a booking confirmation email to the guest.
 * Fire-and-forget: catches errors and logs them.
 */
export async function sendBookingConfirmationToGuest(booking: BookingDetails): Promise<void> {
  try {
    const provider = getEmailProvider()
    const { date, time } = formatBookingDateTime(booking.startAt, booking.endAt, booking.guestTimezone)
    const cancellationUrl = buildCancellationUrl(booking.cancellationToken)
    const rescheduleUrl = buildRescheduleUrl(booking.rescheduleToken)

    const { subject, html, text } = bookingConfirmationGuestTemplate({
      eventTitle: booking.eventTitle,
      date,
      time,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      hostName: booking.hostName,
      timezone: booking.guestTimezone,
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

    const result = await provider.send(payload)
    if (!result.success) {
      console.error(`[Email] Failed to send booking confirmation to guest ${booking.guestEmail}:`, result.error)
    }
  } catch (error) {
    console.error('[Email] Error sending booking confirmation to guest:', error)
  }
}

/**
 * Sends a booking notification email to the host.
 * Fire-and-forget: catches errors and logs them.
 */
export async function sendBookingNotificationToHost(booking: BookingDetails): Promise<void> {
  try {
    const provider = getEmailProvider()
    const { date, time } = formatBookingDateTime(booking.startAt, booking.endAt, booking.guestTimezone)

    const { subject, html, text } = bookingNotificationHostTemplate({
      eventTitle: booking.eventTitle,
      date,
      time,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      hostName: booking.hostName,
      timezone: booking.guestTimezone,
    })

    const payload: EmailPayload = {
      to: booking.hostEmail,
      subject,
      html,
      text,
      idempotencyKey: `booking-notification:${booking.bookingId}:host`,
    }

    const result = await provider.send(payload)
    if (!result.success) {
      console.error(`[Email] Failed to send booking notification to host ${booking.hostEmail}:`, result.error)
    }
  } catch (error) {
    console.error('[Email] Error sending booking notification to host:', error)
  }
}

/**
 * Sends a cancellation email to either the guest or the host.
 * Fire-and-forget: catches errors and logs them.
 */
export async function sendCancellationEmail(
  booking: BookingDetails,
  recipient: 'guest' | 'host'
): Promise<void> {
  try {
    const provider = getEmailProvider()
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

    const result = await provider.send(payload)
    if (!result.success) {
      console.error(`[Email] Failed to send cancellation email to ${recipient} (${toEmail}):`, result.error)
    }
  } catch (error) {
    console.error(`[Email] Error sending cancellation email to ${recipient}:`, error)
  }
}
