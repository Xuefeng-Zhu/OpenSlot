import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getClientIp } from '@/lib/security/rate-limit'

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileVerificationResult =
  | { ok: true; enforced: boolean }
  | { ok: false; status: 400 | 503; error: string }

interface TurnstileSiteverifyResponse {
  success?: boolean
  'error-codes'?: string[]
}

/**
 * Verifies a Cloudflare Turnstile token when TURNSTILE_SECRET_KEY is configured.
 * Unconfigured environments skip enforcement so local development and previews
 * can run without Cloudflare credentials.
 */
export async function verifyTurnstileToken({
  request,
  token,
}: {
  request: NextRequest
  token?: string
}): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    return { ok: true, enforced: false }
  }

  const normalizedToken = token?.trim()
  if (!normalizedToken) {
    return {
      ok: false,
      status: 400,
      error: 'Verification challenge is required',
    }
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: normalizedToken,
      remoteip: getClientIp(request),
      idempotency_key: randomUUID(),
    })

    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      body,
    })

    if (!response.ok) {
      return {
        ok: false,
        status: 503,
        error: 'Could not verify challenge',
      }
    }

    const result = (await response.json()) as TurnstileSiteverifyResponse

    if (!result.success) {
      return {
        ok: false,
        status: 400,
        error: 'Verification challenge failed',
      }
    }

    return { ok: true, enforced: true }
  } catch (error) {
    console.error('Error verifying Turnstile token:', error)
    return {
      ok: false,
      status: 503,
      error: 'Could not verify challenge',
    }
  }
}
