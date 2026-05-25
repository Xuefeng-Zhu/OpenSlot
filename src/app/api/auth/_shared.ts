import { NextResponse } from 'next/server'
import { createAdminBackendClient } from '@/lib/backend/server'
import {
  cookiesForBackendSession,
  cookiesForBackendSignOut,
  setResponseCookies,
} from '@/lib/backend/server'
import type { BackendCompatSession } from '@/lib/backend/compat/query-client'
import type { BackendSession } from '@/lib/backend/ports'

export function authJson<TBody>(
  body: TBody,
  init?: ResponseInit
) {
  return NextResponse.json(body, init)
}

export function authError(message: string, status = 400) {
  return authJson({ success: false, error: message }, { status })
}

export function sessionResponse(
  session: BackendCompatSession | BackendSession,
  keepSignedIn: boolean,
  init?: ResponseInit
) {
  const response = authJson({ success: true, user: session.user }, init)
  setResponseCookies(response, cookiesForBackendSession(session, keepSignedIn))
  return response
}

export function signOutResponse() {
  const response = authJson({ success: true })
  setResponseCookies(response, cookiesForBackendSignOut())
  return response
}

type AuthProfileSyncResult =
  | { ok: true }
  | { ok: false; error: string }

export async function ensureProfileForAuthUser(input: {
  authUserId: string
  email: string | null
  displayName?: string | null
}): Promise<AuthProfileSyncResult> {
  const adminClient = createAdminBackendClient()
  const email = input.email ?? ''
  const now = new Date().toISOString()
  const displayName = input.displayName?.trim()
  const profilePayload: {
    auth_user_id: string
    email: string
    updated_at: string
    name?: string
  } = {
    auth_user_id: input.authUserId,
    email,
    updated_at: now,
  }

  if (displayName) {
    profilePayload.name = displayName
  }

  const { error } = await adminClient
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'auth_user_id' })

  if (error) {
    console.error('Error ensuring auth profile:', error)
    return {
      ok: false,
      error: 'Unable to prepare your profile. Please try again.',
    }
  }

  return { ok: true }
}
