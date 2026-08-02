import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import HomePage from '@/app/page'

describe('landing page links', () => {
  it('points landing navigation and demo CTAs at rendered targets', () => {
    const { container } = render(<HomePage />)

    expect(container.querySelector('#features')).not.toBeNull()
    expect(container.querySelector('#demo')).not.toBeNull()
    expect(container.querySelector('#how-it-works')).not.toBeNull()

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeDefined()
    expect(screen.getAllByRole('link', { name: 'Features' })[0].getAttribute('href')).toBe(
      '#features'
    )
    expect(screen.getAllByRole('link', { name: 'Preview' })[0].getAttribute('href')).toBe(
      '#demo'
    )
    expect(
      screen.getAllByRole('link', { name: 'How it works' })[0].getAttribute('href')
    ).toBe('#how-it-works')

    expect(screen.queryByRole('link', { name: 'Use cases' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Pricing' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Docs' })).toBeNull()
    const previewLinks = screen.getAllByRole('link', { name: 'Preview booking UI' })
    expect(previewLinks).toHaveLength(2)
    for (const link of previewLinks) {
      expect(link.getAttribute('href')).toBe('#demo')
    }
  })

  it('uses factual product copy instead of unverified adoption claims', () => {
    render(<HomePage />)

    expect(
      screen.getByText('Timezone-aware booking with built-in conflict protection.')
    ).toBeDefined()
    expect(
      screen.getByText('Publish your availability and prevent overlapping bookings.')
    ).toBeDefined()
    expect(screen.queryByText(/loved by|2,000|thousands/i)).toBeNull()
  })

  it('exposes the mobile disclosure as navigation with a list of links', () => {
    render(<HomePage />)

    const menuButton = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(menuButton)

    const mobileNavigation = screen.getByRole('navigation', {
      name: 'Mobile navigation',
    })
    expect(menuButton.getAttribute('aria-expanded')).toBe('true')
    expect(menuButton.getAttribute('aria-controls')).toBe('mobile-menu')
    expect(within(mobileNavigation).getByRole('list')).toBeDefined()
    expect(within(mobileNavigation).getAllByRole('listitem')).toHaveLength(5)
    expect(within(mobileNavigation).getAllByRole('link')).toHaveLength(5)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByRole('menuitem')).toBeNull()

    fireEvent.click(within(mobileNavigation).getByRole('link', { name: 'Preview' }))

    expect(
      screen.queryByRole('navigation', { name: 'Mobile navigation' })
    ).toBeNull()
  })
})
