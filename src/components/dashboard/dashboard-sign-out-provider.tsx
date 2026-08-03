'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { requestJson } from '@/components/dashboard/request-json'
import { useDashboardNavigationGuard } from '@/components/dashboard/navigation-guard-provider'
import { useToast } from '@/components/ui/use-toast'

interface DashboardSignOutContextValue {
  isSigningOut: boolean
  signOut: () => void
}

const DashboardSignOutContext =
  createContext<DashboardSignOutContextValue | null>(null)

/** Coordinates one guarded sign-out request across all dashboard controls. */
export function DashboardSignOutProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { toast } = useToast()
  const { requestNavigation } = useDashboardNavigationGuard()
  const requestInFlightRef = useRef(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const performSignOut = useCallback(async () => {
    if (requestInFlightRef.current) return

    requestInFlightRef.current = true
    setIsSigningOut(true)

    try {
      const result = await requestJson<{ success: boolean }>(
        '/api/auth/logout',
        { method: 'POST' },
        'Unable to sign out. Please try again.'
      )

      if (!result.success) {
        throw new Error('Unable to sign out. Please try again.')
      }

      router.replace('/login')
      router.refresh()
    } catch {
      requestInFlightRef.current = false
      setIsSigningOut(false)
      toast({
        title: 'Could not sign out',
        description: 'Your session is still active. Please try again.',
        variant: 'destructive',
      })
    }
  }, [router, toast])

  const signOut = useCallback(() => {
    requestNavigation(() => {
      void performSignOut()
    })
  }, [performSignOut, requestNavigation])

  const value = useMemo(
    () => ({ isSigningOut, signOut }),
    [isSigningOut, signOut]
  )

  return (
    <DashboardSignOutContext.Provider value={value}>
      {children}
    </DashboardSignOutContext.Provider>
  )
}

/** Provides the shared dashboard sign-out action and pending state. */
export function useDashboardSignOut() {
  const context = useContext(DashboardSignOutContext)

  if (!context) {
    throw new Error(
      'useDashboardSignOut must be used within DashboardSignOutProvider'
    )
  }

  return context
}
