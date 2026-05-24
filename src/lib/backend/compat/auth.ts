import type { ButterbaseHttpClient } from '../butterbase/http-client'
import { invokeCompatFunction } from './function-mapping'
import { mapCompatResponse, requestAsCompat } from './responses'
import type {
  AuthMode,
  BackendCompatAuthPort,
  BackendCompatClient,
  BackendCompatResponse,
  BackendCompatSession,
  BackendCompatUser,
} from './types'

interface ButterbaseAuthUser {
  id: string
  email?: string | null
  email_verified?: boolean
  display_name?: string | null
  avatar_url?: string | null
}

interface ButterbaseAuthSession {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  user: ButterbaseAuthUser
}

export class BackendCompatAuth implements BackendCompatAuthPort {
  admin?: BackendCompatClient['auth']['admin']

  constructor(
    private readonly httpClient: ButterbaseHttpClient,
    private readonly authMode: AuthMode
  ) {
    if (authMode === 'service') {
      this.admin = {
        deleteUser: async (userId: string) =>
          invokeCompatFunction(this.httpClient, 'deleteAuthUser', { userId }),
      }
    }
  }

  async getUser() {
    const response = await requestAsCompat<ButterbaseAuthUser>(this.httpClient, {
      path: `/auth/${this.httpClient.appId}/me`,
      auth: this.authMode === 'user' ? 'user' : 'none',
    })

    return {
      data: { user: response.data ? mapAuthUser(response.data) : null },
      error: response.error,
    }
  }

  async getSession() {
    const userResponse = await this.getUser()
    if (userResponse.error || !userResponse.data.user) {
      return {
        data: { session: null },
        error: userResponse.error,
      }
    }

    return {
      data: { session: null },
      error: null,
    }
  }

  async signInWithPassword(input: { email: string; password: string }) {
    const response = await requestAsCompat<ButterbaseAuthSession>(
      this.httpClient,
      {
        method: 'POST',
        path: `/auth/${this.httpClient.appId}/login`,
        auth: 'none',
        body: input,
      }
    )

    return mapCompatResponse(response, mapAuthSession)
  }

  async signUp(input: {
    email: string
    password: string
    options?: { data?: { full_name?: string; name?: string } }
  }) {
    const displayName =
      input.options?.data?.full_name ?? input.options?.data?.name ?? undefined
    const response = await requestAsCompat<ButterbaseAuthUser>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/signup`,
      auth: 'none',
      body: {
        email: input.email,
        password: input.password,
        display_name: displayName,
      },
    })

    return mapCompatResponse(response, (user) => ({
      user: user ? mapAuthUser(user) : null,
    }))
  }

  async updateUser(input: {
    userId?: string
    email?: string
    password?: string
  }) {
    const result = await invokeCompatFunction<unknown>(
      this.httpClient,
      'updateAuthUser',
      input
    )
    if (result.error) return { data: null, error: result.error }
    return { data: { user: null }, error: null }
  }

  async resetPasswordForEmail(email: string) {
    return requestAsCompat<{ success: true }>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/forgot-password`,
      auth: 'none',
      body: { email },
    })
  }

  async exchangeCodeForSession(code: string) {
    return requestAsCompat<BackendCompatSession>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/magic-link/verify`,
      auth: 'none',
      body: { code },
    })
  }

  async signOut() {
    return requestAsCompat<{ success: true }>(this.httpClient, {
      method: 'POST',
      path: `/auth/${this.httpClient.appId}/logout`,
      auth: this.authMode,
    })
  }
}

function mapAuthUser(user: ButterbaseAuthUser): BackendCompatUser {
  return {
    id: user.id,
    email: user.email ?? null,
    user_metadata: {
      full_name: user.display_name ?? null,
      avatar_url: user.avatar_url ?? null,
      email_verified: user.email_verified ?? false,
    },
  }
}

function mapAuthSession(session: ButterbaseAuthSession): BackendCompatSession {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: mapAuthUser(session.user),
  }
}
