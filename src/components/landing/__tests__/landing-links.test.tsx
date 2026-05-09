import { render, screen } from '@testing-library/react'
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
    expect(screen.getAllByRole('link', { name: 'Demo' })[0].getAttribute('href')).toBe(
      '#demo'
    )
    expect(
      screen.getAllByRole('link', { name: 'How it works' })[0].getAttribute('href')
    ).toBe('#how-it-works')

    expect(screen.queryByRole('link', { name: 'Use cases' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Pricing' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Docs' })).toBeNull()
    expect(screen.getAllByRole('link', { name: 'View demo page' })).toHaveLength(2)
  })
})
