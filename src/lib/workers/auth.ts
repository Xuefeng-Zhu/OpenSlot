import type { NextRequest } from 'next/server'

export type WorkerAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

export function authorizeWorkerRequest(
  request: NextRequest,
  specificSecretName: 'OUTBOX_PROCESS_SECRET' | 'WEBHOOK_PROCESS_SECRET' | 'CALENDAR_SYNC_SECRET'
): WorkerAuthResult {
  const configuredSecrets = [
    process.env[specificSecretName],
    process.env.CRON_SECRET,
  ].filter(Boolean)

  if (configuredSecrets.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        status: 503,
        error: 'Worker secret is not configured',
      }
    }

    return { ok: true }
  }

  const authorization = request.headers.get('authorization')
  const authorized = configuredSecrets.some(
    (secret) => authorization === `Bearer ${secret}`
  )

  if (!authorized) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return { ok: true }
}
