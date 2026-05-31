import type { TimeSlot } from '@/lib/availability/types'

const SLOT_HOLD_TOKEN_TTL_MS = 5 * 60 * 1000

interface SlotHoldTokenPayload {
  hostUserId: string
  eventTypeId: string
  startAt: string
  endAt: string
  expiresAt: string
}

export type SlotHoldTokenVerificationResult =
  | { ok: true }
  | {
      ok: false
      reason: 'missing_secret' | 'malformed' | 'mismatch' | 'expired'
    }

/**
 * Adds short-lived signed hold tokens to computed public slots. The token lets
 * `/api/holds` trust a slot that was just computed by the server, avoiding a
 * second full availability lookup while keeping the reservation RPC as the
 * final race guard.
 */
export async function addSlotHoldTokens({
  slots,
  hostUserId,
  eventTypeId,
}: {
  slots: TimeSlot[]
  hostUserId: string
  eventTypeId: string
}): Promise<TimeSlot[]> {
  return Promise.all(
    slots.map(async (slot) => ({
      ...slot,
      slotToken: await createSlotHoldToken({
        hostUserId,
        eventTypeId,
        startAt: slot.start,
        endAt: slot.end,
      }),
    }))
  )
}

export async function createSlotHoldToken({
  hostUserId,
  eventTypeId,
  startAt,
  endAt,
  now = new Date(),
}: {
  hostUserId: string
  eventTypeId: string
  startAt: string
  endAt: string
  now?: Date
}): Promise<string> {
  const payload: SlotHoldTokenPayload = {
    hostUserId,
    eventTypeId,
    startAt,
    endAt,
    expiresAt: new Date(now.getTime() + SLOT_HOLD_TOKEN_TTL_MS).toISOString(),
  }
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  )
  const signature = await sign(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export async function verifySlotHoldToken({
  token,
  hostUserId,
  eventTypeId,
  startAt,
  endAt,
  now = new Date(),
}: {
  token: string
  hostUserId: string
  eventTypeId: string
  startAt: string
  endAt: string
  now?: Date
}): Promise<SlotHoldTokenVerificationResult> {
  const [encodedPayload, signature, extra] = token.split('.')
  if (!encodedPayload || !signature || extra !== undefined) {
    return { ok: false, reason: 'malformed' }
  }

  const secret = slotTokenSecret()
  if (!secret) {
    return { ok: false, reason: 'missing_secret' }
  }

  const validSignature = await verifySignature(encodedPayload, signature, secret)
  if (!validSignature) {
    return { ok: false, reason: 'malformed' }
  }

  const payload = decodePayload(encodedPayload)
  if (!payload) {
    return { ok: false, reason: 'malformed' }
  }

  if (
    payload.hostUserId !== hostUserId ||
    payload.eventTypeId !== eventTypeId ||
    payload.startAt !== startAt ||
    payload.endAt !== endAt
  ) {
    return { ok: false, reason: 'mismatch' }
  }

  const expiresAtMs = new Date(payload.expiresAt).getTime()
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }

  return { ok: true }
}

function decodePayload(encodedPayload: string): SlotHoldTokenPayload | null {
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    ) as Partial<SlotHoldTokenPayload>

    if (
      typeof payload.hostUserId !== 'string' ||
      typeof payload.eventTypeId !== 'string' ||
      typeof payload.startAt !== 'string' ||
      typeof payload.endAt !== 'string' ||
      typeof payload.expiresAt !== 'string'
    ) {
      return null
    }

    return payload as SlotHoldTokenPayload
  } catch {
    return null
  }
}

async function sign(encodedPayload: string): Promise<string> {
  const secret = slotTokenSecret()
  if (!secret) {
    throw new Error('Slot hold token signing secret is not configured')
  }

  const key = await signingKey(secret, ['sign'])
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload)
  )

  return base64UrlEncode(new Uint8Array(signature))
}

async function verifySignature(
  encodedPayload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const key = await signingKey(secret, ['verify'])
    return crypto.subtle.verify(
      'HMAC',
      key,
      toArrayBuffer(base64UrlDecode(signature)),
      new TextEncoder().encode(encodedPayload)
    )
  } catch {
    return false
  }
}

async function signingKey(
  secret: string,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  )
}

/**
 * Returns the HMAC signing secret for slot hold tokens.
 * Never falls back to BUTTERBASE_API_KEY — that credential is the service-role
 * key used for RLS-bypassing admin operations and must not be reused as a
 * token-signing secret.
 */
function slotTokenSecret(): string | null {
  return (
    process.env.SLOT_HOLD_TOKEN_SECRET ??
    process.env.BUTTERBASE_FUNCTION_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'test-slot-hold-token-secret' : null)
  )
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  )
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
