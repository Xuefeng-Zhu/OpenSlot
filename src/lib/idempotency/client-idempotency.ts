/**
 * Creates a browser-side idempotency key for mounted mutation forms.
 *
 * The randomUUID path is used in modern browsers. The timestamp/random fallback
 * preserves the existing client behavior for runtimes without randomUUID.
 */
export function createClientIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
