import { NextRequest, NextResponse } from 'next/server'
import { handleGoogleCalendarWebhook } from '@/lib/calendar/watches'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Receives Google Calendar push notifications for availability calendars.
 * Validation happens against hashed channel tokens stored in provider_watches.
 */
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const result = await handleGoogleCalendarWebhook(
    createAdminClient(),
    request.headers
  )

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    )
  }

  return new NextResponse(null, { status: result.status })
}
