import {
  resolveButterbaseConfig,
  type ButterbaseBackendConfig,
} from '@/lib/backend/butterbase/config'
import {
  DEFAULT_BOOKING_AGENT_MODEL,
  type BookingAgentProvider,
  type BookingAgentProviderInput,
} from '@/lib/booking-agent/types'

interface ButterbaseChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  error?: {
    message?: string
    code?: string
  }
}

export class BookingAgentGatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string
  ) {
    super(message)
    this.name = 'BookingAgentGatewayError'
  }
}

export interface ButterbaseBookingAgentProviderOptions
  extends Partial<ButterbaseBackendConfig> {
  model?: string
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

/**
 * Calls Butterbase's OpenAI-compatible model gateway with a server-only API key.
 */
export class ButterbaseBookingAgentProvider implements BookingAgentProvider {
  private readonly appId: string
  private readonly apiUrl: string
  private readonly apiKey?: string
  private readonly fetchImpl: typeof fetch
  private readonly model: string
  private readonly maxTokens: number
  private readonly temperature: number
  private readonly timeoutMs: number

  constructor(options: ButterbaseBookingAgentProviderOptions = {}) {
    const config = resolveButterbaseConfig(options)

    this.appId = config.appId
    this.apiUrl = config.apiUrl.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.fetchImpl = config.fetchImpl ?? fetch
    this.model =
      options.model ??
      process.env.BOOKING_AGENT_MODEL ??
      DEFAULT_BOOKING_AGENT_MODEL
    this.maxTokens = options.maxTokens ?? 700
    this.temperature = options.temperature ?? 0.2
    this.timeoutMs = options.timeoutMs ?? 12_000
  }

  async complete(input: BookingAgentProviderInput): Promise<string> {
    if (!this.apiKey) {
      throw new BookingAgentGatewayError('Butterbase AI gateway is not configured')
    }

    const controller =
      this.timeoutMs > 0 && typeof AbortController !== 'undefined'
        ? new AbortController()
        : null
    const timeout =
      controller && typeof setTimeout !== 'undefined'
        ? setTimeout(() => controller.abort(), this.timeoutMs)
        : null

    try {
      const response = await this.fetchImpl(
        `${this.apiUrl}/v1/${this.appId}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          signal: controller?.signal,
          body: JSON.stringify({
            model: this.model,
            messages: input.messages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            stream: false,
          }),
        }
      )

      const parsed = (await response.json().catch(() => null)) as
        | ButterbaseChatCompletionResponse
        | null

      if (!response.ok) {
        throw new BookingAgentGatewayError(
          gatewayErrorMessage(parsed) ??
            `Butterbase AI gateway returned HTTP ${response.status}`,
          response.status,
          parsed?.error?.code
        )
      }

      const content = parsed?.choices?.[0]?.message?.content
      if (!content) {
        throw new BookingAgentGatewayError(
          'Butterbase AI gateway returned an empty response',
          response.status
        )
      }

      return content
    } catch (error) {
      if (isAbortError(error)) {
        throw new BookingAgentGatewayError(
          'Butterbase AI gateway timed out',
          504,
          'timeout'
        )
      }

      throw error
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

export function isBookingAgentConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_BUTTERBASE_APP_ID && process.env.BUTTERBASE_API_KEY
  )
}

function gatewayErrorMessage(
  body: ButterbaseChatCompletionResponse | null
): string | undefined {
  return body?.error?.message
}
