import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AvailabilitySaveBar } from '../availability-save-bar'

describe('AvailabilitySaveBar', () => {
  it('shows the default hint when the block reason is empty', () => {
    render(
      <AvailabilitySaveBar
        isSaving={false}
        saveBlockedReason=""
        onDiscard={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByText('Save before leaving this page.')).toBeDefined()
    expect(
      (screen.getByRole('button', {
        name: 'Save availability',
      }) as HTMLButtonElement).disabled
    ).toBe(false)
  })
})
