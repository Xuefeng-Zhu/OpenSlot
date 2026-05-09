import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TopBar } from '../top-bar'

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

  it('opens help and notification menus from header controls', async () => {
    render(
      <TopBar
        title="Dashboard"
        user={{ name: 'Jane Doe', email: 'jane@example.com' }}
      />
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Help' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(await screen.findByRole('menuitem', { name: 'Set availability' })).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Create event type' })).toBeDefined()

    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Notifications' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(await screen.findByText('No new notifications.')).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'View bookings' })).toBeDefined()
    expect(screen.queryByText('3')).toBeNull()
  })
})
