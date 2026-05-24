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
