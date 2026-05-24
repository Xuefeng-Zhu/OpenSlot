export function providerHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function parseProviderJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string }
    error_description?: string
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        data.error_description ??
        `Provider request failed with HTTP ${response.status}`
    )
  }

  return data
}

export function calendarErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
