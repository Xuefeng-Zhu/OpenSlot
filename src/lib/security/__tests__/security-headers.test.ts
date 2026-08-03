import { createRequire } from 'module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { E2E_BACKEND_APP_ID_HEADER } from '../../../../e2e/support/target-guard'

type Header = {
  key: string
  value: string
}

type HeaderRule = {
  source: string
  headers: Header[]
}

const require = createRequire(import.meta.url)
const nextConfig = require('../../../../next.config.js') as {
  headers: () => Promise<HeaderRule[]>
}

async function getConfiguredHeaders() {
  const [rule] = await nextConfig.headers()

  return {
    source: rule.source,
    headers: new Map(rule.headers.map((header) => [header.key, header.value])),
  }
}

describe('security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('applies hardened production browser security headers', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_BUTTERBASE_API_URL', 'https://api.butterbase.ai')
    vi.stubEnv('NEXT_PUBLIC_BUTTERBASE_APP_ID', 'qa-app-id')

    const { source, headers } = await getConfiguredHeaders()
    const csp = headers.get('Content-Security-Policy') ?? ''

    expect(source).toBe('/:path*')
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains'
    )
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('Permissions-Policy')).toContain('camera=()')
    expect(headers.get(E2E_BACKEND_APP_ID_HEADER)).toBe('qa-app-id')

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("script-src-attr 'none'")
    expect(csp).toContain('https://api.butterbase.ai')
    expect(csp).toContain('wss://api.butterbase.ai')
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('does not advertise an empty Butterbase app id', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUTTERBASE_APP_ID', '')

    const { headers } = await getConfiguredHeaders()

    expect(headers.has(E2E_BACKEND_APP_ID_HEADER)).toBe(false)
  })

  it('keeps local development allowances out of production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const { headers } = await getConfiguredHeaders()
    const csp = headers.get('Content-Security-Policy') ?? ''

    expect(csp).not.toContain('http://localhost:*')
    expect(csp).not.toContain('ws://localhost:*')
    expect(csp).not.toContain('http://127.0.0.1:*')
    expect(csp).not.toContain('ws://127.0.0.1:*')
  })

  it('allows local Butterbase and Next development connections without HSTS', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_BUTTERBASE_API_URL', 'http://127.0.0.1:54321')

    const { headers } = await getConfiguredHeaders()
    const csp = headers.get('Content-Security-Policy') ?? ''

    expect(headers.has('Strict-Transport-Security')).toBe(false)
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain('http://127.0.0.1:54321')
    expect(csp).toContain('ws://127.0.0.1:54321')
    expect(csp).toContain('http://localhost:*')
    expect(csp).toContain('ws://localhost:*')
    expect(csp).not.toContain('upgrade-insecure-requests')
  })
})
