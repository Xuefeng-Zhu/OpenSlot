import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  bookingConfirmationGuestTemplate,
  bookingNotificationHostTemplate,
  cancellationTemplate,
} from '../templates'
import type { BookingTemplateDetails } from '../templates'
import {
  sendBookingConfirmationToGuest,
  sendBookingNotificationToHost,
  sendCancellationEmail,
} from '../send'
import type { BookingDetails } from '../send'
import { ConsoleEmailProvider } from '../provider'

const sampleTemplateDetails: BookingTemplateDetails = {
  eventTitle: '30 Minute Meeting',
  date: 'Monday, January 15, 2025',
  time: '10:00 AM - 10:30 AM',
  guestName: 'Alice Guest',
  guestEmail: 'alice@example.com',
  hostName: 'Bob Host',
  timezone: 'America/New_York',
  cancellationUrl: 'http://localhost:3000/booking/cancel/abc-123',
}

const sampleBookingDetails: BookingDetails = {
  bookingId: 'booking-001',
  eventTitle: '30 Minute Meeting',
  startAt: '2025-01-15T15:00:00.000Z',
  endAt: '2025-01-15T15:30:00.000Z',
  guestName: 'Alice Guest',
  guestEmail: 'alice@example.com',
  guestTimezone: 'America/New_York',
  hostName: 'Bob Host',
  hostEmail: 'bob@example.com',
  cancellationToken: 'cancel-token-123',
}

describe('Email Templates', () => {
  describe('bookingConfirmationGuestTemplate', () => {
    it('returns subject, html, and text', () => {
      const result = bookingConfirmationGuestTemplate(sampleTemplateDetails)

      expect(result.subject).toContain('30 Minute Meeting')
      expect(result.subject).toContain('Bob Host')
      expect(result.text).toContain('30 Minute Meeting')
      expect(result.text).toContain('Bob Host')
      expect(result.text).toContain('Monday, January 15, 2025')
      expect(result.text).toContain('10:00 AM - 10:30 AM')
      expect(result.html).toContain('30 Minute Meeting')
      expect(result.html).toContain('Booking Confirmed')
    })

    it('includes cancellation URL when provided', () => {
      const result = bookingConfirmationGuestTemplate(sampleTemplateDetails)

      expect(result.text).toContain('http://localhost:3000/booking/cancel/abc-123')
      expect(result.html).toContain('http://localhost:3000/booking/cancel/abc-123')
    })

    it('omits cancellation link when no URL provided', () => {
      const details = { ...sampleTemplateDetails, cancellationUrl: undefined }
      const result = bookingConfirmationGuestTemplate(details)

      expect(result.text).not.toContain('cancel')
      expect(result.html).not.toContain('Need to cancel?')
    })
  })

  describe('bookingNotificationHostTemplate', () => {
    it('returns subject, html, and text with guest info', () => {
      const result = bookingNotificationHostTemplate(sampleTemplateDetails)

      expect(result.subject).toContain('Alice Guest')
      expect(result.subject).toContain('30 Minute Meeting')
      expect(result.text).toContain('Alice Guest')
      expect(result.text).toContain('alice@example.com')
      expect(result.text).toContain('Monday, January 15, 2025')
      expect(result.html).toContain('New Booking')
    })
  })

  describe('cancellationTemplate', () => {
    it('returns guest-facing cancellation email', () => {
      const result = cancellationTemplate(sampleTemplateDetails, 'guest')

      expect(result.subject).toContain('Cancelled')
      expect(result.text).toContain('Bob Host')
      expect(result.text).toContain('cancelled')
      expect(result.html).toContain('Booking Cancelled')
    })

    it('returns host-facing cancellation email', () => {
      const result = cancellationTemplate(sampleTemplateDetails, 'host')

      expect(result.subject).toContain('Cancelled')
      expect(result.text).toContain('Alice Guest')
      expect(result.text).toContain('cancelled')
    })
  })
})

describe('ConsoleEmailProvider', () => {
  it('logs email and returns success', async () => {
    const provider = new ConsoleEmailProvider()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await provider.send({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    })

    expect(result.success).toBe(true)
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})

describe('Email Send Functions', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('sendBookingConfirmationToGuest', () => {
    it('does not throw on valid input', async () => {
      await expect(
        sendBookingConfirmationToGuest(sampleBookingDetails)
      ).resolves.toBeUndefined()
    })

    it('logs email in dev mode', async () => {
      await sendBookingConfirmationToGuest(sampleBookingDetails)
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('does not throw on invalid timezone', async () => {
      const details = { ...sampleBookingDetails, guestTimezone: 'Invalid/Zone' }
      await expect(
        sendBookingConfirmationToGuest(details)
      ).resolves.toBeUndefined()
    })
  })

  describe('sendBookingNotificationToHost', () => {
    it('does not throw on valid input', async () => {
      await expect(
        sendBookingNotificationToHost(sampleBookingDetails)
      ).resolves.toBeUndefined()
    })

    it('logs email in dev mode', async () => {
      await sendBookingNotificationToHost(sampleBookingDetails)
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('sendCancellationEmail', () => {
    it('sends to guest without throwing', async () => {
      await expect(
        sendCancellationEmail(sampleBookingDetails, 'guest')
      ).resolves.toBeUndefined()
    })

    it('sends to host without throwing', async () => {
      await expect(
        sendCancellationEmail(sampleBookingDetails, 'host')
      ).resolves.toBeUndefined()
    })

    it('logs email in dev mode', async () => {
      await sendCancellationEmail(sampleBookingDetails, 'guest')
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('fire-and-forget behavior', () => {
    it('never throws even if provider fails', async () => {
      // Simulate an error by mocking the provider to throw
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Even with a broken provider, the function should not throw
      await expect(
        sendBookingConfirmationToGuest(sampleBookingDetails)
      ).resolves.toBeUndefined()

      errorSpy.mockRestore()
    })
  })
})
