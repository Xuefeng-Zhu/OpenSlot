import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Drawer } from '../drawer'

describe('Drawer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves focus into the drawer and restores the previous focus on close', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const { rerender } = render(
      <>
        <button type="button">Open drawer</button>
        <Drawer open={false} onClose={onClose} title="Booking details">
          <button type="button">First action</button>
        </Drawer>
      </>
    )

    const opener = screen.getByRole('button', { name: 'Open drawer' })
    opener.focus()

    rerender(
      <>
        <button type="button">Open drawer</button>
        <Drawer open onClose={onClose} title="Booking details">
          <button type="button">First action</button>
        </Drawer>
      </>
    )

    vi.runAllTimers()

    expect(document.activeElement).toBe(
      screen.getByRole('dialog', { name: 'Booking details' })
    )

    rerender(
      <>
        <button type="button">Open drawer</button>
        <Drawer open={false} onClose={onClose} title="Booking details">
          <button type="button">First action</button>
        </Drawer>
      </>
    )

    expect(document.activeElement).toBe(opener)
  })

  it('keeps tab focus inside the drawer', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Navigation menu">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Drawer>
    )

    const dialog = screen.getByRole('dialog', { name: 'Navigation menu' })
    const closeButton = screen.getByRole('button', { name: 'Close' })
    const lastButton = screen.getByRole('button', { name: 'Last action' })

    lastButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })

    expect(document.activeElement).toBe(closeButton)

    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(lastButton)
  })
})
