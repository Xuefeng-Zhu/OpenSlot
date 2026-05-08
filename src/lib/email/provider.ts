/**
 * Email provider abstraction layer.
 *
 * Defines the interface for email delivery providers (Resend, Postmark, etc.)
 * and the payload structure for outgoing emails.
 */

export interface EmailPayload {
  to: string
  from?: string
  subject: string
  html: string
  text: string
  idempotencyKey?: string
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<{ success: boolean; error?: string }>
}

/**
 * Console-based email provider for development.
 * Logs email content to the console instead of sending.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    console.log('─────────────────────────────────────────')
    console.log(`📧 [Dev Email] To: ${payload.to}`)
    if (payload.from) {
      console.log(`   From: ${payload.from}`)
    }
    console.log(`   Subject: ${payload.subject}`)
    console.log(`   Text:\n${payload.text}`)
    console.log('─────────────────────────────────────────')
    return { success: true }
  }
}

interface ResendEmailResponse {
  id?: string
  message?: string
  error?: string
  name?: string
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (payload.idempotencyKey) {
      headers['Idempotency-Key'] = payload.idempotencyKey
    }

    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: payload.from ?? this.defaultFrom,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    })
    const data = (await response.json().catch(() => ({}))) as ResendEmailResponse

    if (!response.ok) {
      return {
        success: false,
        error:
          data.message ??
          data.error ??
          data.name ??
          `Resend API returned HTTP ${response.status}`,
      }
    }

    return { success: true }
  }
}
