import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DashboardSignOutProvider,
  useDashboardSignOut,
} from '../dashboard-sign-out-provider'
import {
  DashboardNavigationGuardProvider,
  useDashboardUnsavedChanges,
} from '../navigation-guard-provider'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

function SignOutButton({ twice = false }: { twice?: boolean }) {
  const { isSigningOut, signOut } = useDashboardSignOut()

  return (
    <button
      type="button"
      onClick={() => {
        signOut()
        if (twice) signOut()
      }}
    >
      {isSigningOut ? 'Signing out' : 'Sign out'}
    </button>
  )
}

function DirtyState() {
  useDashboardUnsavedChanges('sign-out-test', true, () => undefined)
  return <SignOutButton />
}

function renderSignOut(children: React.ReactNode) {
  return render(
    <DashboardNavigationGuardProvider>
      <DashboardSignOutProvider>{children}</DashboardSignOutProvider>
    </DashboardNavigationGuardProvider>
  )
}

describe('DashboardSignOutProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls the existing logout API and redirects only after success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    renderSignOut(<SignOutButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
      })
      expect(mocks.replace).toHaveBeenCalledWith('/login')
      expect(mocks.refresh).toHaveBeenCalledOnce()
    })
  })

  it('prevents duplicate requests while sign-out is pending', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    renderSignOut(<SignOutButton twice />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(fetchMock).toHaveBeenCalledOnce()

    resolveRequest?.(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'))
  })

  it('keeps the session in place and shows an error toast on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'safe server error' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    renderSignOut(<SignOutButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: 'Could not sign out',
        description: 'Your session is still active. Please try again.',
        variant: 'destructive',
      })
    })
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined()
  })

  it('respects the unsaved-change guard before starting sign-out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    renderSignOut(<DirtyState />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard and continue' })
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  })
})
