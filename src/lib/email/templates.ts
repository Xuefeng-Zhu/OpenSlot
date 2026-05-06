/**
 * Email templates for booking notifications.
 *
 * Each template function returns { subject, html, text } for use with the email provider.
 */

export interface BookingTemplateDetails {
  eventTitle: string
  date: string // formatted date string (e.g., "Monday, January 15, 2025")
  time: string // formatted time string (e.g., "10:00 AM - 10:30 AM")
  guestName: string
  guestEmail: string
  hostName: string
  timezone: string
  cancellationUrl?: string
}

export function bookingConfirmationGuestTemplate(details: BookingTemplateDetails): {
  subject: string
  html: string
  text: string
} {
  const { eventTitle, date, time, hostName, timezone, cancellationUrl } = details

  const subject = `Booking Confirmed: ${eventTitle} with ${hostName}`

  const text = [
    `Your booking has been confirmed!`,
    ``,
    `Event: ${eventTitle}`,
    `Host: ${hostName}`,
    `Date: ${date}`,
    `Time: ${time} (${timezone})`,
    cancellationUrl ? `\nNeed to cancel? ${cancellationUrl}` : '',
    ``,
    `Thank you for booking with OpenSlot.`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">Booking Confirmed</h2>
  <p>Your booking has been confirmed!</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; font-weight: bold;">Event</td><td style="padding: 8px;">${eventTitle}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Host</td><td style="padding: 8px;">${hostName}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${date}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${time} (${timezone})</td></tr>
  </table>
  ${cancellationUrl ? `<p><a href="${cancellationUrl}" style="color: #dc2626;">Need to cancel?</a></p>` : ''}
  <p style="color: #666; font-size: 14px;">Thank you for booking with OpenSlot.</p>
</body>
</html>`.trim()

  return { subject, html, text }
}

export function bookingNotificationHostTemplate(details: BookingTemplateDetails): {
  subject: string
  html: string
  text: string
} {
  const { eventTitle, date, time, guestName, guestEmail, timezone } = details

  const subject = `New Booking: ${eventTitle} with ${guestName}`

  const text = [
    `You have a new booking!`,
    ``,
    `Event: ${eventTitle}`,
    `Guest: ${guestName} (${guestEmail})`,
    `Date: ${date}`,
    `Time: ${time} (${timezone})`,
    ``,
    `View your bookings in the OpenSlot dashboard.`,
  ].join('\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">New Booking</h2>
  <p>You have a new booking!</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; font-weight: bold;">Event</td><td style="padding: 8px;">${eventTitle}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Guest</td><td style="padding: 8px;">${guestName} (${guestEmail})</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${date}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${time} (${timezone})</td></tr>
  </table>
  <p style="color: #666; font-size: 14px;">View your bookings in the OpenSlot dashboard.</p>
</body>
</html>`.trim()

  return { subject, html, text }
}

export function cancellationTemplate(
  details: BookingTemplateDetails,
  recipient: 'guest' | 'host'
): {
  subject: string
  html: string
  text: string
} {
  const { eventTitle, date, time, guestName, hostName, timezone } = details

  const isGuest = recipient === 'guest'
  const subject = `Booking Cancelled: ${eventTitle}`
  const otherParty = isGuest ? hostName : guestName

  const text = [
    `A booking has been cancelled.`,
    ``,
    `Event: ${eventTitle}`,
    isGuest ? `Host: ${hostName}` : `Guest: ${guestName}`,
    `Date: ${date}`,
    `Time: ${time} (${timezone})`,
    ``,
    isGuest
      ? `Your booking with ${otherParty} has been cancelled. You can rebook at any time.`
      : `The booking with ${otherParty} has been cancelled. The time slot is now available again.`,
  ].join('\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #dc2626;">Booking Cancelled</h2>
  <p>A booking has been cancelled.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; font-weight: bold;">Event</td><td style="padding: 8px;">${eventTitle}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">${isGuest ? 'Host' : 'Guest'}</td><td style="padding: 8px;">${otherParty}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${date}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${time} (${timezone})</td></tr>
  </table>
  <p style="color: #666; font-size: 14px;">${
    isGuest
      ? `Your booking with ${otherParty} has been cancelled. You can rebook at any time.`
      : `The booking with ${otherParty} has been cancelled. The time slot is now available again.`
  }</p>
</body>
</html>`.trim()

  return { subject, html, text }
}
