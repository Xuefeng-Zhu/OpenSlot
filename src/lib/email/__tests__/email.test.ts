import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  bookingConfirmationGuestTemplate,
  bookingNotificationHostTemplate,
  cancellationTemplate,
} from '../templates'
import type { BookingTemplateDetails } from '../templates'
import {
  getEmailProvider,
  sendBookingConfirmationToGuest,
  sendBookingNotificationToHost,
  sendCancellationEmail,
} from '../send'
import type { BookingDetails } from '../send'
import { ConsoleEmailProvider, MailerooEmailProvider, ResendEmailProvider } from '../provider'

const originalEmailEnv = {
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  EMAIL_FROM: process.env.EMAIL_FROM,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MAILEROO_API_KEY: process.env.MAILEROO_API_KEY,
}

afterEach(() => {
  process.env.EMAIL_PROVIDER = originalEmailEnv.EMAIL_PROVIDER
  process.env.EMAIL_FROM = originalEmailEnv.EMAIL_FROM
  process.env.RESEND_API_KEY = originalEmailEnv.RESEND_API_KEY
  process.env.MAILEROO_API_KEY = originalEmailEnv.MAILEROO_API_KEY
  vi.unstubAllGlobals()
})

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

    it('escapes html-sensitive values in the html body', () => {
      const details = {
        ...sampleTemplateDetails,
        eventTitle: '<script>alert("x")</script>',
        hostName: 'Bob & Sons',
        cancellationUrl: 'https://example.com/cancel?x="bad"&next=<tag>',
      }

      const result = bookingConfirmationGuestTemplate(details)

      expect(result.text).toContain('<script>alert("x")</script>')
      expect(result.html).not.toContain('<script>')
      expect(result.html).not.toContain('href="https://example.com/cancel?x="bad"')
      expect(result.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
      expect(result.html).toContain('Bob &amp; Sons')
      expect(result.html).toContain('x=&quot;bad&quot;&amp;next=&lt;tag&gt;')
    })

    it('includes generated conference details when provided', () => {
      const result = bookingConfirmationGuestTemplate({
        ...sampleTemplateDetails,
        locationLabel: 'Google Meet',
        conferenceUrl: 'https://meet.google.com/aaa-bbbb-ccc',
      })

      expect(result.text).toContain('Location: Google Meet')
      expect(result.text).toContain('Join link: https://meet.google.com/aaa-bbbb-ccc')
      expect(result.html).toContain('Google Meet')
      expect(result.html).toContain('https://meet.google.com/aaa-bbbb-ccc')
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

    it('escapes guest details in html', () => {
      const result = bookingNotificationHostTemplate({
        ...sampleTemplateDetails,
        guestName: 'Alice <img src=x onerror=alert(1)>',
        guestEmail: 'alice&guest@example.com',
      })

      expect(result.text).toContain('Alice <img src=x onerror=alert(1)>')
      expect(result.html).not.toContain('<img')
      expect(result.html).toContain('Alice &lt;img src=x onerror=alert(1)&gt;')
      expect(result.html).toContain('alice&amp;guest@example.com')
    })

    it('includes generated conference details for hosts', () => {
      const result = bookingNotificationHostTemplate({
        ...sampleTemplateDetails,
        locationLabel: 'Microsoft Teams',
        conferenceUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
      })

      expect(result.text).toContain('Location: Microsoft Teams')
      expect(result.text).toContain(
        'Join link: https://teams.microsoft.com/l/meetup-join/abc'
      )
      expect(result.html).toContain('Microsoft Teams')
      expect(result.html).toContain('https://teams.microsoft.com/l/meetup-join/abc')
    })

    it('includes escaped invitee answer summaries for the host', () => {
      const result = bookingNotificationHostTemplate({
        ...sampleTemplateDetails,
        bookingAnswers: [
          {
            questionId: 'topic',
            label: 'Topic <focus>',
            type: 'textarea',
            required: true,
            value: 'Roadmap & launch',
          },
        ],
      })

      expect(result.text).toContain('Topic <focus>: Roadmap & launch')
      expect(result.html).toContain('Topic &lt;focus&gt;')
      expect(result.html).toContain('Roadmap &amp; launch')
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

    it('escapes the other party in cancellation html', () => {
      const result = cancellationTemplate(
        {
          ...sampleTemplateDetails,
          guestName: 'Alice <b>Guest</b>',
        },
        'host'
      )

      expect(result.text).toContain('Alice <b>Guest</b>')
      expect(result.html).not.toContain('<b>Guest</b>')
      expect(result.html).toContain('Alice &lt;b&gt;Guest&lt;/b&gt;')
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

describe('ResendEmailProvider', () => {
  it('sends email through the Resend API', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'email-id' }), { status: 200 })
    )
    const provider = new ResendEmailProvider(
      'resend-key',
      'OpenSlot <bookings@example.com>',
      fetchImpl as typeof fetch
    )

    const result = await provider.send({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
      idempotencyKey: 'email-key',
    })

    expect(result).toEqual({ success: true })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer resend-key',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'email-key',
        }),
        body: JSON.stringify({
          from: 'OpenSlot <bookings@example.com>',
          to: ['test@example.com'],
          subject: 'Test Subject',
          html: '<p>Hello</p>',
          text: 'Hello',
        }),
      })
    )
  })

  it('returns provider errors without throwing', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Domain not verified' }), {
        status: 422,
      })
    )
    const provider = new ResendEmailProvider(
      'resend-key',
      'OpenSlot <bookings@example.com>',
      fetchImpl as typeof fetch
    )

    await expect(
      provider.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      })
    ).resolves.toEqual({
      success: false,
      error: 'Domain not verified',
    })
  })

  it('is selected when EMAIL_PROVIDER is resend', () => {
    process.env.EMAIL_PROVIDER = 'resend'
    process.env.EMAIL_FROM = 'OpenSlot <bookings@example.com>'
    process.env.RESEND_API_KEY = 'resend-key'

    expect(getEmailProvider()).toBeInstanceOf(ResendEmailProvider)
  })
})

describe('MailerooEmailProvider', () => {
  it('sends email through the Maileroo API', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          message: 'The email has been scheduled for delivery.',
          data: { reference_id: 'c843204e3af03193bd14f339' },
        }),
        { status: 200 }
      )
    )
    const provider = new MailerooEmailProvider(
      'maileroo-key',
      'OpenSlot <bookings@example.com>',
      fetchImpl as typeof fetch
    )

    const result = await provider.send({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
      idempotencyKey: 'email-key',
    })

    expect(result).toEqual({ success: true })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://smtp.maileroo.com/api/v2/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer maileroo-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          from: {
            address: 'bookings@example.com',
            display_name: 'OpenSlot',
          },
          to: [{ address: 'test@example.com' }],
          subject: 'Test Subject',
          html: '<p>Hello</p>',
          plain: 'Hello',
          reference_id: 'c247c9a162a54b48a44d1be6',
        }),
      })
    )
  })

  it('returns provider errors without throwing', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          message: 'The sender domain is not verified.',
        }),
        { status: 422 }
      )
    )
    const provider = new MailerooEmailProvider(
      'maileroo-key',
      'bookings@example.com',
      fetchImpl as typeof fetch
    )

    await expect(
      provider.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      })
    ).resolves.toEqual({
      success: false,
      error: 'The sender domain is not verified.',
    })
  })

  it('is selected when EMAIL_PROVIDER is maileroo', () => {
    process.env.EMAIL_PROVIDER = 'maileroo'
    process.env.EMAIL_FROM = 'OpenSlot <bookings@example.com>'
    process.env.MAILEROO_API_KEY = 'maileroo-key'

    expect(getEmailProvider()).toBeInstanceOf(MailerooEmailProvider)
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

    it('uses the configured Resend provider', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.EMAIL_FROM = 'OpenSlot <bookings@example.com>'
      process.env.RESEND_API_KEY = 'resend-key'
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ id: 'email-id' }), { status: 200 })
      )
      vi.stubGlobal('fetch', fetchMock)

      await sendBookingConfirmationToGuest(sampleBookingDetails)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer resend-key',
          }),
        })
      )
    })

    it('uses the configured Maileroo provider', async () => {
      process.env.EMAIL_PROVIDER = 'maileroo'
      process.env.EMAIL_FROM = 'OpenSlot <bookings@example.com>'
      process.env.MAILEROO_API_KEY = 'maileroo-key'
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
      vi.stubGlobal('fetch', fetchMock)

      await sendBookingConfirmationToGuest(sampleBookingDetails)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://smtp.maileroo.com/api/v2/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer maileroo-key',
          }),
        })
      )
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
