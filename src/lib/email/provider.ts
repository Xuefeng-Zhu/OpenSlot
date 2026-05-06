/**
 * Email provider abstraction layer.
 *
 * Defines the interface for email delivery providers (Resend, Postmark, etc.)
 * and the payload structure for outgoing emails.
 */

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text: string
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
    console.log(`   Subject: ${payload.subject}`)
    console.log(`   Text:\n${payload.text}`)
    console.log('─────────────────────────────────────────')
    return { success: true }
  }
}
