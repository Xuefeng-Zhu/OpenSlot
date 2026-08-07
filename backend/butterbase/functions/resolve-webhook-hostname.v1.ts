interface ButterbaseFunctionContext {
  caller?: {
    type?: 'service_key' | 'end_user_jwt' | 'loopback' | 'anonymous'
  }
}

interface DenoDnsRuntime {
  resolveDns(
    query: string,
    recordType: 'A' | 'AAAA'
  ): Promise<string[]>
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

/**
 * Resolves all IPv4 and IPv6 addresses for a validated webhook hostname inside
 * the trusted Butterbase runtime. The caller rejects the destination if any
 * returned address is non-public and repeats the check for every redirect.
 */
export default async function handler(
  req: Request,
  ctx: ButterbaseFunctionContext
): Promise<Response> {
  if (ctx.caller?.type !== 'service_key') {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  if (req.method !== 'POST') {
    return json(
      { success: false, error: 'Method not allowed' },
      405,
      { Allow: 'POST' }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'Invalid request' }, 400)
  }

  if (!isValidInput(body)) {
    return json({ success: false, error: 'Invalid request' }, 400)
  }

  const hostname = body.hostname.replace(/\.+$/, '').toLowerCase()
  const denoRuntime = (globalThis as typeof globalThis & { Deno?: DenoDnsRuntime })
    .Deno

  if (!denoRuntime?.resolveDns) {
    return json({ success: false, error: 'DNS resolution unavailable' }, 503)
  }

  try {
    const [ipv4, ipv6] = await Promise.all([
      denoRuntime.resolveDns(hostname, 'A'),
      denoRuntime.resolveDns(hostname, 'AAAA'),
    ])

    return json({ addresses: [...new Set([...ipv4, ...ipv6])] })
  } catch {
    return json({ success: false, error: 'DNS resolution failed' }, 502)
  }
}

function isValidInput(value: unknown): value is { hostname: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const input = value as Record<string, unknown>
  return (
    Object.keys(input).length === 1 &&
    typeof input.hostname === 'string' &&
    HOSTNAME_PATTERN.test(input.hostname.replace(/\.+$/, ''))
  )
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  })
}
