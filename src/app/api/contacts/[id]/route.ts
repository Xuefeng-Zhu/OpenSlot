import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { anonymizeContact } from '@/lib/contacts/contacts'

interface ContactRouteProps {
  params: Promise<{ id: string }>
}

const contactIdSchema = z.string().uuid()

/**
 * Resolves the current session to a profile id before service-key contact
 * writes, so a guessed contact id cannot cross tenant boundaries.
 */
async function getAuthenticatedProfileId() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false as const, status: 404, error: 'Profile not found' }
  }

  return { ok: true as const, profileId: (profile as { id: string }).id }
}

/**
 * Soft-anonymizes a host-owned contact and matching booking display fields.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: ContactRouteProps
) {
  try {
    const auth = await getAuthenticatedProfileId()

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const { id } = await params
    const parsedId = contactIdSchema.safeParse(id)

    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid contact id' },
        { status: 400 }
      )
    }

    const result = await anonymizeContact(createAdminClient(), {
      contactId: parsedId.data,
      hostUserId: auth.profileId,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error.includes('not found') ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      anonymizedBookings: result.anonymizedBookings,
    })
  } catch (error) {
    console.error('Error in DELETE /api/contacts/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
