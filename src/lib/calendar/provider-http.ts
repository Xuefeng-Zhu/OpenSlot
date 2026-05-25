export function providerHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

interface ProviderErrorResponse {
  error?: { message?: string }
  error_description?: string
}

export async function parseProviderJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch((error: unknown) => {
    if (response.ok) {
      throw new Error('Provider returned malformed JSON', { cause: error })
    }

    return null
  })) as (T & ProviderErrorResponse) | null

  if (!response.ok) {
    throw new Error(
      data?.error?.message ??
        data?.error_description ??
        `Provider request failed with HTTP ${response.status}`
    )
  }

  return data as T
}

export function calendarErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
