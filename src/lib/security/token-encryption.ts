import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  base64UrlDecodeToBytes,
  base64UrlEncodeBytes,
  concatBytes,
  randomBase64Url,
  sha256Bytes,
} from '@/lib/security/edge-crypto'

const TOKEN_PREFIX = 'v1'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const DEVELOPMENT_SECRET = 'openslot-development-calendar-token-secret'

/**
 * Encrypts a provider OAuth token for server-side storage.
 * Uses AES-256-GCM with a random IV and prefixes the ciphertext format so future
 * migrations can distinguish new encryption versions.
 */
export async function encryptToken(token: string): Promise<string> {
  const iv = base64UrlDecodeToBytes(randomBase64Url(IV_LENGTH))
  const key = tokenEncryptionKey()
  const encryptedWithTag = await aesGcmEncrypt(token, key, iv)
  const encrypted = encryptedWithTag.slice(
    0,
    encryptedWithTag.length - AUTH_TAG_LENGTH
  )
  const authTag = encryptedWithTag.slice(-AUTH_TAG_LENGTH)

  return [
    TOKEN_PREFIX,
    base64UrlEncodeBytes(iv),
    base64UrlEncodeBytes(authTag),
    base64UrlEncodeBytes(encrypted),
  ].join(':')
}

/**
 * Decrypts a token produced by encryptToken.
 * Throws when the version marker is unsupported or authentication fails, which
 * prevents callers from silently using corrupted provider credentials.
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  const [version, ivValue, authTagValue, encryptedValue] =
    encryptedToken.split(':')

  if (version !== TOKEN_PREFIX || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Unsupported encrypted token format')
  }

  return aesGcmDecrypt(
    concatBytes(base64UrlDecodeToBytes(encryptedValue), base64UrlDecodeToBytes(authTagValue)),
    tokenEncryptionKey(),
    base64UrlDecodeToBytes(ivValue)
  )
}

function tokenEncryptionKey(): Uint8Array {
  const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_SECRET is not configured')
  }

  return sha256Bytes(new TextEncoder().encode(secret ?? DEVELOPMENT_SECRET))
}
