import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileForm } from '../profile-form'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@/lib/backend/compat/browser-client', () => ({
  createBrowserBackendClient: () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  }),
}))

const initialData = {
  name: 'Test User',
  username: 'test-user',
  default_timezone: 'America/Los_Angeles',
  public_headline: 'Advisor',
  public_bio: 'I help teams schedule better.',
  response_time_label: 'Within a day',
}

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1', email: 'test@example.com' } },
    })
    mocks.from.mockReturnValue({ update: mocks.update })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockResolvedValue({ error: null })
  })

  it('refreshes server-rendered dashboard data after a successful profile save', async () => {
    render(<ProfileForm initialData={initialData} />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Updated User' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status').textContent).toBe(
      'Profile updated successfully.'
    )
    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated User' })
    )
    expect(mocks.eq).toHaveBeenCalledWith('auth_user_id', 'auth-user-1')
  })
})
