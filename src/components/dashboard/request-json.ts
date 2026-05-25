"use client"

export function errorToastDescription(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred. Please try again."
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackError: string
): Promise<T> {
  const response = await fetch(input, init)
  const result = (await response.json().catch(() => null)) as {
    error?: string
  } | null

  if (!response.ok) {
    throw new Error(result?.error || fallbackError)
  }

  if (!result) {
    throw new Error(fallbackError)
  }

  return result as T
}
