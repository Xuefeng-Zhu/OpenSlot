import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

const TOKEN_PREFIX = 'v1'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const DEVELOPMENT_SECRET = 'openslot-development-calendar-token-secret'

/**
 * Encrypts a provider OAuth token for server-side storage.
 * Uses AES-256-GCM with a random IV and prefixes the ciphertext format so future
 * migrations can distinguish new encryption versions.
 */
export function encryptToken(token: string): string {
  const iv = randomBytes(IV_LENGTH)
  const key = tokenEncryptionKey()
  const cipher = createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    TOKEN_PREFIX,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(encrypted),
  ].join(':')
}

/**
 * Decrypts a token produced by encryptToken.
 * Throws when the version marker is unsupported or authentication fails, which
 * prevents callers from silently using corrupted provider credentials.
 */
export function decryptToken(encryptedToken: string): string {
  const [version, ivValue, authTagValue, encryptedValue] =
    encryptedToken.split(':')

  if (version !== TOKEN_PREFIX || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Unsupported encrypted token format')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    tokenEncryptionKey(),
    fromBase64Url(ivValue),
    { authTagLength: AUTH_TAG_LENGTH }
  )
  decipher.setAuthTag(fromBase64Url(authTagValue))

  return Buffer.concat([
    decipher.update(fromBase64Url(encryptedValue)),
    decipher.final(),
  ]).toString('utf8')
}

function tokenEncryptionKey(): Buffer {
  const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_SECRET is not configured')
  }

  return createHash('sha256')
    .update(secret ?? DEVELOPMENT_SECRET)
    .digest()
}

function toBase64Url(value: Buffer): string {
  return value
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function fromBase64Url(value: string): Buffer {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  return Buffer.from(padded.replaceAll('-', '+').replaceAll('_', '/'), 'base64')
}
