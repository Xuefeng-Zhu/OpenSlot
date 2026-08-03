import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  calendarAppOrigin,
  calendarCallbackUrl,
} from '@/lib/calendar/oauth-state'

describe('calendar OAuth public origin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the configured canonical origin instead of the request host', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://openslot.example/path')
    const request = new NextRequest('https://attacker.example/start')

    expect(calendarAppOrigin(request)).toBe('https://openslot.example')
    expect(calendarCallbackUrl(request, 'google')).toBe(
      'https://openslot.example/api/calendar/oauth/google/callback'
    )
  })

  it('fails closed in production when the canonical origin is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    const request = new NextRequest('https://attacker.example/start')

    expect(() => calendarAppOrigin(request)).toThrow(
      'NEXT_PUBLIC_APP_URL is required for calendar OAuth'
    )
  })

  it('allows the request origin only outside production', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'test')
    const request = new NextRequest('http://localhost:3000/start')

    expect(calendarAppOrigin(request)).toBe('http://localhost:3000')
  })
})
