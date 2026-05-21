import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import { sha256Hex } from '@/lib/security/edge-crypto'
import type { Database } from '@/lib/types/database'

export interface PublicRateLimitConfig {
  scope: string
  limit: number
  windowSeconds: number
  identifierParts?: Array<string | null | undefined>
}

export type PublicRateLimitResult =
  | {
      allowed: true
      limit: number
      remaining: number
      resetAt: string
    }
  | {
      allowed: false
      status: 429 | 503
      error: string
      limit: number
      remaining: number
      resetAt: string
      retryAfterSeconds: number
    }

/**
 * Consumes one fixed-window rate-limit attempt for a public endpoint.
 * The database stores only hashed request fingerprints, never raw IPs, user
 * agents, emails, or tokens.
 */
export async function consumePublicRateLimit({
  request,
  adminClient,
  config,
}: {
  request: NextRequest
  adminClient: BackendCompatClient<Database>
  config: PublicRateLimitConfig
}): Promise<PublicRateLimitResult> {
  const identifierHash = hashRateLimitIdentifier([
    getClientIp(request),
    request.headers.get('user-agent') ?? 'unknown-user-agent',
    ...(config.identifierParts ?? []),
  ])

  const { data, error } = await adminClient
    .rpc('consume_public_rate_limit', {
      p_scope: config.scope,
      p_identifier_hash: identifierHash,
      p_limit_count: config.limit,
      p_window_seconds: config.windowSeconds,
    })
    .single()

  if (error || !data) {
    console.error('Error consuming public rate limit:', error)
    return {
      allowed: false,
      status: 503,
      error: 'Could not verify request rate limit',
      limit: config.limit,
      remaining: 0,
      resetAt: new Date().toISOString(),
      retryAfterSeconds: 60,
    }
  }

  if (data.allowed) {
    return {
      allowed: true,
      limit: data.limit_count,
      remaining: data.remaining,
      resetAt: data.reset_at,
    }
  }

  return {
    allowed: false,
    status: 429,
    error: 'Too many requests. Please retry after the rate limit resets.',
    limit: data.limit_count,
    remaining: data.remaining,
    resetAt: data.reset_at,
    retryAfterSeconds: data.retry_after_seconds,
  }
}

export function publicRateLimitResponse(
  result: Extract<PublicRateLimitResult, { allowed: false }>
) {
  const response = NextResponse.json(publicRateLimitResponseBody(result), {
    status: result.status,
  })

  response.headers.set('Retry-After', String(result.retryAfterSeconds))
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', result.resetAt)

  return response
}

export function publicRateLimitResponseBody(
  result: Extract<PublicRateLimitResult, { allowed: false }>
) {
  return {
    success: false,
    error: result.error,
    rateLimit: {
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
      retryAfterSeconds: result.retryAfterSeconds,
    },
  }
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown-ip'
  )
}

function hashRateLimitIdentifier(parts: Array<string | null | undefined>): string {
  return sha256Hex(
    `openslot:public-rate-limit:v1${parts.map((part) => part ?? '').join('\n')}`
  )
}
