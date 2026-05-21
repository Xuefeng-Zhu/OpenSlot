import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addSlotHoldTokens,
  createSlotHoldToken,
  verifySlotHoldToken,
} from '../slot-token'

const hostUserId = '22222222-2222-4222-8222-222222222222'
const eventTypeId = '11111111-1111-4111-8111-111111111111'
const startAt = '2026-06-16T18:00:00.000Z'
const endAt = '2026-06-16T18:30:00.000Z'

describe('slot hold tokens', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('verifies a fresh signed token for the matching slot', async () => {
    vi.stubEnv('SLOT_HOLD_TOKEN_SECRET', 'test-secret')

    const token = await createSlotHoldToken({
      hostUserId,
      eventTypeId,
      startAt,
      endAt,
      now: new Date('2026-06-16T17:55:00.000Z'),
    })

    await expect(
      verifySlotHoldToken({
        token,
        hostUserId,
        eventTypeId,
        startAt,
        endAt,
        now: new Date('2026-06-16T17:56:00.000Z'),
      })
    ).resolves.toEqual({ ok: true })
  })

  it('rejects mismatched and expired tokens', async () => {
    vi.stubEnv('SLOT_HOLD_TOKEN_SECRET', 'test-secret')
    const token = await createSlotHoldToken({
      hostUserId,
      eventTypeId,
      startAt,
      endAt,
      now: new Date('2026-06-16T17:55:00.000Z'),
    })

    await expect(
      verifySlotHoldToken({
        token,
        hostUserId,
        eventTypeId,
        startAt: '2026-06-16T18:30:00.000Z',
        endAt: '2026-06-16T19:00:00.000Z',
      })
    ).resolves.toEqual({ ok: false, reason: 'mismatch' })

    await expect(
      verifySlotHoldToken({
        token,
        hostUserId,
        eventTypeId,
        startAt,
        endAt,
        now: new Date('2026-06-16T18:01:00.000Z'),
      })
    ).resolves.toEqual({ ok: false, reason: 'expired' })
  })

  it('adds tokens to public slot payloads', async () => {
    vi.stubEnv('SLOT_HOLD_TOKEN_SECRET', 'test-secret')

    const slots = await addSlotHoldTokens({
      hostUserId,
      eventTypeId,
      slots: [{ start: startAt, end: endAt }],
    })

    expect(slots).toEqual([
      {
        start: startAt,
        end: endAt,
        slotToken: expect.any(String),
      },
    ])
  })
})
