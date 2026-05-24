import { NextRequest, NextResponse } from 'next/server'
import {
  createAdminBackendClient,
  createServerBackendClient,
} from '@/lib/backend/server'
import { saveAvailabilitySchema } from '@/lib/validations/availability'
import {
  getAuthenticatedAvailabilityProfile,
  loadOwnedSchedule,
} from './availability-route-utils'
import { parseJsonBody } from '@/lib/http/json'
import { shouldUseFunctionFallback } from '@/lib/backend/compat/function-fallback'
import type { BackendCompatClient } from '@/lib/backend/compat/query-client'
import type { Database } from '@/lib/types/database'
import type { SaveAvailabilityInput } from '@/lib/validations/availability'

/**
 * POST /api/availability
 *
 * Batch save availability rules and overrides through one backend transaction
 * function. The route validates auth, ownership, and request shape before
 * handing the mutation to the provider-owned atomic entrypoint.
 *
 * Requires authentication. Uses the authenticated user's profile ID for all operations.
 * Uses the admin client (service key) to bypass RLS for write operations.
 *
 * Request body: { rules, overrides, deletedRuleIds, deletedOverrideIds, timezone }
 * Response: { success: true } or { success: false, error: string }
 */
export const runtime = 'edge'

interface SaveAvailabilityFunctionResult {
  rules?: unknown[]
  overrides?: unknown[]
}

export async function POST(request: NextRequest) {
  try {
    const backendClient = await createServerBackendClient()
    const auth = await getAuthenticatedAvailabilityProfile(backendClient)

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const json = await parseJsonBody(request)
    if (!json.ok) return json.response

    const parsed = saveAvailabilitySchema.safeParse(json.body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const {
      scheduleId,
      rules,
      overrides,
      deletedRuleIds,
      deletedOverrideIds,
      timezone,
    } = parsed.data
    const adminClient = createAdminBackendClient()
    const userId = auth.profile.id

    const scheduleResult = await loadOwnedSchedule(
      adminClient,
      scheduleId,
      userId
    )

    if (!scheduleResult.ok) {
      return NextResponse.json(
        { success: false, error: scheduleResult.error },
        { status: scheduleResult.status }
      )
    }

    const { data: savedAvailability, error: saveError } = await adminClient
      .rpc('save_availability', {
        p_user_id: userId,
        p_schedule_id: scheduleId,
        p_timezone: timezone,
        p_rules: rules,
        p_overrides: overrides,
        p_deleted_rule_ids: deletedRuleIds,
        p_deleted_override_ids: deletedOverrideIds,
      })
      .single()

    if (saveError) {
      if (shouldUseFunctionFallback(saveError)) {
        console.warn(
          'Falling back to non-transactional availability save because the backend function is unavailable:',
          saveError
        )
        const fallbackResult = await saveAvailabilityDirectly(adminClient, {
          input: parsed.data,
          userId,
        })

        if (fallbackResult.ok) {
          return NextResponse.json({
            success: true,
            rules: fallbackResult.saved.rules,
            overrides: fallbackResult.saved.overrides,
          })
        }

        console.error('Error saving availability fallback:', fallbackResult.error)
        return NextResponse.json(
          { success: false, error: 'Failed to save availability' },
          { status: 500 }
        )
      }

      console.error('Error saving availability transaction:', saveError)
      return NextResponse.json(
        { success: false, error: 'Failed to save availability' },
        { status: 500 }
      )
    }

    const saved = savedAvailability as SaveAvailabilityFunctionResult | null

    return NextResponse.json({
      success: true,
      rules: saved?.rules ?? [],
      overrides: saved?.overrides ?? [],
    })
  } catch (error) {
    console.error('Error in POST /api/availability:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function saveAvailabilityDirectly(
  adminClient: BackendCompatClient<Database>,
  {
    input,
    userId,
  }: {
    input: SaveAvailabilityInput
    userId: string
  }
): Promise<
  | { ok: true; saved: Required<SaveAvailabilityFunctionResult> }
  | { ok: false; error: unknown }
> {
  const {
    scheduleId,
    rules,
    overrides,
    deletedRuleIds,
    deletedOverrideIds,
    timezone,
  } = input
  const now = new Date().toISOString()

  const scheduleUpdate = await adminClient
    .from('schedules')
    .update({ timezone, updated_at: now })
    .eq('id', scheduleId)
    .eq('user_id', userId)

  if (scheduleUpdate.error) {
    return { ok: false, error: scheduleUpdate.error }
  }

  if (deletedRuleIds.length > 0) {
    const deletedRules = await adminClient
      .from('availability_rules')
      .delete()
      .eq('user_id', userId)
      .eq('schedule_id', scheduleId)
      .in('id', deletedRuleIds)

    if (deletedRules.error) return { ok: false, error: deletedRules.error }
  }

  if (deletedOverrideIds.length > 0) {
    const deletedOverrides = await adminClient
      .from('availability_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('schedule_id', scheduleId)
      .in('id', deletedOverrideIds)

    if (deletedOverrides.error) {
      return { ok: false, error: deletedOverrides.error }
    }
  }

  for (const rule of rules) {
    const payload = {
      user_id: userId,
      schedule_id: scheduleId,
      weekday: rule.weekday,
      start_time: rule.start_time,
      end_time: rule.end_time,
      timezone,
      is_active: rule.is_active,
      updated_at: now,
    }
    const result = rule.id
      ? await adminClient
          .from('availability_rules')
          .update(payload)
          .eq('id', rule.id)
          .eq('user_id', userId)
          .eq('schedule_id', scheduleId)
      : await adminClient.from('availability_rules').insert(payload)

    if (result.error) return { ok: false, error: result.error }
  }

  for (const override of overrides) {
    const payload = {
      user_id: userId,
      schedule_id: scheduleId,
      date: override.date,
      start_time: override.start_time,
      end_time: override.end_time,
      timezone,
      is_available: override.is_available,
      reason: override.reason ?? null,
      updated_at: now,
    }
    const result = override.id
      ? await adminClient
          .from('availability_overrides')
          .update(payload)
          .eq('id', override.id)
          .eq('user_id', userId)
          .eq('schedule_id', scheduleId)
      : await adminClient.from('availability_overrides').insert(payload)

    if (result.error) return { ok: false, error: result.error }
  }

  const { data: savedRules, error: rulesError } = await adminClient
    .from('availability_rules')
    .select('id, weekday, start_time, end_time, is_active')
    .eq('user_id', userId)
    .eq('schedule_id', scheduleId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })

  if (rulesError) return { ok: false, error: rulesError }

  const { data: savedOverrides, error: overridesError } = await adminClient
    .from('availability_overrides')
    .select('id, date, start_time, end_time, is_available, reason')
    .eq('user_id', userId)
    .eq('schedule_id', scheduleId)
    .order('date', { ascending: true })

  if (overridesError) return { ok: false, error: overridesError }

  return {
    ok: true,
    saved: {
      rules: savedRules ?? [],
      overrides: savedOverrides ?? [],
    },
  }
}
