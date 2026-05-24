/**
 * Email provider abstraction layer.
 *
 * Defines the interface for email delivery providers (Resend, Maileroo, etc.)
 * and the payload structure for outgoing emails.
 */

import { sha256Hex } from '@/lib/security/edge-crypto'

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

interface MailerooEmailObject {
  address: string
  display_name?: string
}

interface MailerooEmailResponse {
  success?: boolean
  message?: string
  error?: string
}

interface EmailProviderErrorResponse {
  message?: string
  error?: string
  name?: string
}

async function readEmailProviderJson<T extends EmailProviderErrorResponse>(
  response: Response
): Promise<T> {
  return (await response.json().catch(() => ({}))) as T
}

function emailProviderError(data: EmailProviderErrorResponse, fallback: string): string {
  return data.message ?? data.error ?? data.name ?? fallback
}

function parseEmailObject(value: string): MailerooEmailObject {
  const trimmed = value.trim()
  const match = trimmed.match(/^(?:"?([^"<>]*)"?\s*)?<([^<>]+)>$/)

  if (!match) {
    return { address: trimmed }
  }

  const displayName = match[1]?.trim()
  const address = match[2].trim()

  return displayName ? { address, display_name: displayName } : { address }
}

function buildMailerooReferenceId(idempotencyKey: string): string {
  return sha256Hex(`openslot:${idempotencyKey}`).slice(0, 24)
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
    const data = await readEmailProviderJson<ResendEmailResponse>(response)

    if (!response.ok) {
      return {
        success: false,
        error: emailProviderError(data, `Resend API returned HTTP ${response.status}`),
      }
    }

    return { success: true }
  }
}

export class MailerooEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    const body: {
      from: MailerooEmailObject
      to: MailerooEmailObject[]
      subject: string
      html: string
      plain: string
      reference_id?: string
    } = {
      from: parseEmailObject(payload.from ?? this.defaultFrom),
      to: [parseEmailObject(payload.to)],
      subject: payload.subject,
      html: payload.html,
      plain: payload.text,
    }

    if (payload.idempotencyKey) {
      body.reference_id = buildMailerooReferenceId(payload.idempotencyKey)
    }

    const response = await this.fetchImpl('https://smtp.maileroo.com/api/v2/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await readEmailProviderJson<MailerooEmailResponse>(response)

    if (!response.ok || data.success === false) {
      return {
        success: false,
        error: emailProviderError(
          data,
          response.ok
            ? 'Maileroo API returned an unsuccessful response'
            : `Maileroo API returned HTTP ${response.status}`
        ),
      }
    }

    return { success: true }
  }
}
