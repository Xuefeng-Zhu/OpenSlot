import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  adminClient: {
    rpc: vi.fn(),
    from: vi.fn(() => {
      throw new Error('Unexpected table write in availability route')
    }),
  },
  serverClient: {},
  getAuthenticatedAvailabilityProfile: vi.fn(),
  loadOwnedSchedule: vi.fn(),
}))

vi.mock('@/lib/backend/server', () => ({
  createAdminBackendClient: vi.fn(() => mocks.adminClient),
  createServerBackendClient: vi.fn(async () => mocks.serverClient),
}))

vi.mock('../availability-route-utils', () => ({
  getAuthenticatedAvailabilityProfile: mocks.getAuthenticatedAvailabilityProfile,
  loadOwnedSchedule: mocks.loadOwnedSchedule,
}))

const profileId = '22222222-2222-4222-8222-222222222222'
const scheduleId = '11111111-1111-4111-8111-111111111111'
const existingRuleId = '33333333-3333-4333-8333-333333333333'
const deletedRuleId = '44444444-4444-4444-8444-444444444444'

const validBody = {
  scheduleId,
  rules: [
    {
      id: existingRuleId,
      weekday: 1,
      start_time: '09:00',
      end_time: '10:00',
      is_active: true,
    },
  ],
  overrides: [
    {
      date: '2026-06-17',
      start_time: null,
      end_time: null,
      is_available: false,
      reason: 'OOO',
    },
  ],
  deletedRuleIds: [deletedRuleId],
  deletedOverrideIds: [],
  timezone: 'America/New_York',
}

function requestWithJson(body: unknown) {
  return new Request('http://localhost/api/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function rpcResult(result: { data: unknown; error: unknown | null }) {
  return {
    single: vi.fn(async () => result),
  }
}

describe('POST /api/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthenticatedAvailabilityProfile.mockResolvedValue({
      ok: true,
      profile: {
        id: profileId,
        default_timezone: 'America/New_York',
      },
    })
    mocks.loadOwnedSchedule.mockResolvedValue({
      ok: true,
      schedule: { id: scheduleId, is_default: true },
    })
    mocks.adminClient.rpc.mockReturnValue(
      rpcResult({
        data: { rules: validBody.rules, overrides: validBody.overrides },
        error: null,
      })
    )
  })

  it('delegates the batch save to the atomic backend function', async () => {
    const response = await POST(requestWithJson(validBody) as never)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      rules: validBody.rules,
      overrides: validBody.overrides,
    })
    expect(mocks.loadOwnedSchedule).toHaveBeenCalledWith(
      mocks.adminClient,
      scheduleId,
      profileId
    )
    expect(mocks.adminClient.rpc).toHaveBeenCalledWith('save_availability', {
      p_user_id: profileId,
      p_schedule_id: scheduleId,
      p_timezone: 'America/New_York',
      p_rules: validBody.rules,
      p_overrides: validBody.overrides,
      p_deleted_rule_ids: [deletedRuleId],
      p_deleted_override_ids: [],
    })
    expect(mocks.adminClient.from).not.toHaveBeenCalled()
  })

  it('returns a save error when the atomic backend function fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.adminClient.rpc.mockReturnValue(
      rpcResult({
        data: null,
        error: { message: 'transaction failed' },
      })
    )

    const response = await POST(requestWithJson(validBody) as never)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      success: false,
      error: 'Failed to save availability',
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Error saving availability transaction:',
      { message: 'transaction failed' }
    )
    consoleError.mockRestore()
  })
})
