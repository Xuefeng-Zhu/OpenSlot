import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TopBar } from '../top-bar'
import type { DashboardNotification, DashboardNotifications } from '@/lib/dashboard/notifications'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TopBar', () => {
  it('uses real account data and links the account affordance to profile', () => {
    render(
      <TopBar
        title="Dashboard"
        user={{ name: 'Jane Doe', email: 'jane@example.com' }}
      />
    )

    const profileLink = screen.getByRole('link', {
      name: 'View profile for Jane Doe',
    })

    expect(profileLink.getAttribute('href')).toBe('/profile')
    expect(screen.getByText('Jane Doe')).toBeDefined()
    expect(screen.getByText('jane@example.com')).toBeDefined()
    expect(screen.queryByText('Product Designer')).toBeNull()
  })

  it('opens the empty notification menu from the header controls', async () => {
    render(
      <TopBar
        title="Dashboard"
        user={{ name: 'Jane Doe', email: 'jane@example.com' }}
      />
    )

    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Notifications' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(await screen.findByText('No recent booking activity.')).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'View bookings' })).toBeDefined()
    expect(screen.queryByText('No new notifications.')).toBeNull()
    expect(screen.queryByText('3')).toBeNull()
  })

  it('shows recent booking activity with a count badge', async () => {
    const notifications = notificationState({ unseenCount: 2 })

    render(
      <TopBar
        title="Dashboard"
        notifications={notifications}
        user={{ name: 'Jane Doe', email: 'jane@example.com' }}
      />
    )

    fireEvent.pointerDown(
      screen.getByRole('button', {
        name: 'Notifications (2 unread)',
      }),
      {
        button: 0,
        ctrlKey: false,
      }
    )

    expect(await screen.findByText('Booking cancelled')).toBeDefined()
    expect(screen.getByText("Sam's Strategy Session was cancelled.")).toBeDefined()
    expect(screen.getByText('New booking confirmed')).toBeDefined()
    expect(screen.getByText('Alex booked Discovery Call.')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(
      screen.getByRole('menuitem', {
        name: /Booking cancelled.*Sam's Strategy Session was cancelled\./,
      }).getAttribute('href')
    ).toBe('/bookings')
    expect(screen.getByRole('menuitem', { name: 'View bookings' })).toBeDefined()
    expect(screen.queryByText('No recent booking activity.')).toBeNull()
  })

  it('marks all notifications as read without removing recent activity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          notificationsSeenAt: '2026-05-17T00:00:00.000Z',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <TopBar
        title="Dashboard"
        notifications={notificationState({ unseenCount: 2 })}
        user={{ name: 'Jane Doe', email: 'jane@example.com' }}
      />
    )

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Notifications (2 unread)' }),
      {
        button: 0,
        ctrlKey: false,
      }
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark all as read' }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          hidden: true,
          name: 'Notifications',
        })
      ).toBeDefined()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/seen', {
      method: 'POST',
    })
    expect(screen.getByText('Booking cancelled')).toBeDefined()
    expect(screen.getByText('New booking confirmed')).toBeDefined()
    expect(screen.queryByRole('menuitem', { name: 'Mark all as read' })).toBeNull()
  })

  it('restores the unread badge when marking notifications read fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('server unavailable', {
          status: 500,
        })
      )
    )

    render(
      <TopBar
        title="Dashboard"
        notifications={notificationState({ unseenCount: 2 })}
        user={{ name: 'Jane Doe', email: 'jane@example.com' }}
      />
    )

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Notifications (2 unread)' }),
      {
        button: 0,
        ctrlKey: false,
      }
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark all as read' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not mark as read. Try again.'
    )
    expect(
      screen.getByRole('button', {
        hidden: true,
        name: 'Notifications (2 unread)',
      })
    ).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Mark all as read' })).toBeDefined()
  })
})

function notificationState({
  unseenCount,
}: {
  unseenCount: number
}): DashboardNotifications {
  return {
    unseenCount,
    items: [
      {
        id: 'event-2',
        bookingId: 'booking-2',
        title: 'Booking cancelled',
        description: "Sam's Strategy Session was cancelled.",
        occurredAt: '2026-05-16T18:00:00.000Z',
        href: '/bookings',
      },
      {
        id: 'event-1',
        bookingId: 'booking-1',
        title: 'New booking confirmed',
        description: 'Alex booked Discovery Call.',
        occurredAt: '2026-05-16T17:00:00.000Z',
        href: '/bookings',
      },
    ] satisfies DashboardNotification[],
  }
}
