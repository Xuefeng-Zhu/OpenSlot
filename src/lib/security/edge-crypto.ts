const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const HEX = Array.from({ length: 256 }, (_, index) =>
  index.toString(16).padStart(2, '0')
)
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export function sha256Hex(value: string | Uint8Array): string {
  return bytesToHex(sha256Bytes(toBytes(value)))
}

export function hmacSha256Hex(secret: string, message: string): string {
  const blockSize = 64
  let key = toBytes(secret)

  if (key.length > blockSize) {
    key = sha256Bytes(key)
  }

  const paddedKey = new Uint8Array(blockSize)
  paddedKey.set(key)

  const outer = new Uint8Array(blockSize)
  const inner = new Uint8Array(blockSize)

  for (let index = 0; index < blockSize; index += 1) {
    outer[index] = paddedKey[index] ^ 0x5c
    inner[index] = paddedKey[index] ^ 0x36
  }

  return bytesToHex(sha256Bytes(concatBytes(outer, sha256Bytes(concatBytes(inner, toBytes(message))))))
}

export function randomHex(byteLength: number): string {
  return bytesToHex(randomBytes(byteLength))
}

export function randomBase64Url(byteLength: number): string {
  return base64UrlEncodeBytes(randomBytes(byteLength))
}

export function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function base64UrlEncodeString(value: string): string {
  return base64UrlEncodeBytes(textEncoder.encode(value))
}

export function base64UrlDecodeToString(value: string): string {
  return textDecoder.decode(base64UrlDecodeToBytes(value))
}

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function base64UrlDecodeToBytes(value: string): Uint8Array {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return diff === 0
}

export async function aesGcmEncrypt(
  plaintext: string,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    'AES-GCM',
    false,
    ['encrypt']
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
    cryptoKey,
    toArrayBuffer(textEncoder.encode(plaintext))
  )

  return new Uint8Array(encrypted)
}

export async function aesGcmDecrypt(
  ciphertextWithTag: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    'AES-GCM',
    false,
    ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
    cryptoKey,
    toArrayBuffer(ciphertextWithTag)
  )

  return textDecoder.decode(decrypted)
}

export function sha256Bytes(bytes: Uint8Array): Uint8Array {
  const padded = padSha256Message(bytes)
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const schedule = new Uint32Array(64)

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4
      schedule[index] =
        (padded[start] << 24) |
        (padded[start + 1] << 16) |
        (padded[start + 2] << 8) |
        padded[start + 3]
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(schedule[index - 15], 7) ^
        rotateRight(schedule[index - 15], 18) ^
        (schedule[index - 15] >>> 3)
      const s1 =
        rotateRight(schedule[index - 2], 17) ^
        rotateRight(schedule[index - 2], 19) ^
        (schedule[index - 2] >>> 10)
      schedule[index] =
        (schedule[index - 16] + s0 + schedule[index - 7] + s1) >>> 0
    }

    let a = hash[0]
    let b = hash[1]
    let c = hash[2]
    let d = hash[3]
    let e = hash[4]
    let f = hash[5]
    let g = hash[6]
    let h = hash[7]

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + SHA256_K[index] + schedule[index]) >>> 0
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  const output = new Uint8Array(32)
  for (let index = 0; index < hash.length; index += 1) {
    output[index * 4] = hash[index] >>> 24
    output[index * 4 + 1] = hash[index] >>> 16
    output[index * 4 + 2] = hash[index] >>> 8
    output[index * 4 + 3] = hash[index]
  }

  return output
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }

  return result
}

function randomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytes
}

function toBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? textEncoder.encode(value) : value
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => HEX[byte]).join('')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

function padSha256Message(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  return padded
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}
