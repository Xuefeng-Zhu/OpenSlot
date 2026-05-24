import { NextRequest, NextResponse } from 'next/server'
import { handleMicrosoftCalendarWebhook } from '@/lib/calendar/watches'
import { createAdminBackendClient } from '@/lib/backend/server'

/**
 * Microsoft Graph validates webhook endpoints by requiring the validationToken
 * query value to be returned as text/plain before subscriptions become active.
 */
export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const validationToken = new URL(request.url).searchParams.get('validationToken')

  if (!validationToken) {
    return NextResponse.json(
      { success: false, error: 'Missing validation token' },
      { status: 400 }
    )
  }

  return new NextResponse(validationToken, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/**
 * Receives Microsoft Graph basic change notifications for availability
 * calendars. Resource data is not requested; notifications are validated with
 * the hashed clientState stored in provider_watches.
 */
export async function POST(request: NextRequest) {
  const validationToken = new URL(request.url).searchParams.get('validationToken')

  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const body = await request.json().catch(() => ({}))
  const result = await handleMicrosoftCalendarWebhook(
    createAdminBackendClient(),
    body
  )

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    )
  }

  return NextResponse.json({ success: true }, { status: result.status })
}
