"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type NavigationAction = () => void

interface DirtySource {
  dirty: boolean
  discard: () => void
}

interface DashboardNavigationGuardValue {
  requestNavigation: (action: NavigationAction) => void
  discardAndContinue: (action: NavigationAction) => void
  hasUnsavedChanges: () => boolean
  updateSource: (id: string, dirty: boolean, discard: () => void) => void
  removeSource: (id: string) => void
}

const cleanNavigationGuard: DashboardNavigationGuardValue = {
  requestNavigation: (action) => action(),
  discardAndContinue: (action) => action(),
  hasUnsavedChanges: () => false,
  updateSource: () => undefined,
  removeSource: () => undefined,
}

const DashboardNavigationGuardContext =
  createContext<DashboardNavigationGuardValue>(cleanNavigationGuard)

/**
 * Coordinates dashboard dirty-state sources and confirms navigation before any
 * registered editor state is discarded.
 */
export function DashboardNavigationGuardProvider({
  children,
}: {
  children: ReactNode
}) {
  const sourcesRef = useRef(new Map<string, DirtySource>())
  const pendingActionRef = useRef<NavigationAction | null>(null)
  const [hasDirtySources, setHasDirtySources] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const hasUnsavedChanges = useCallback(
    () => Array.from(sourcesRef.current.values()).some((source) => source.dirty),
    []
  )

  const synchronizeDirtyState = useCallback(() => {
    const nextHasDirtySources = hasUnsavedChanges()
    setHasDirtySources(nextHasDirtySources)

    if (!nextHasDirtySources) {
      pendingActionRef.current = null
      setDialogOpen(false)
    }
  }, [hasUnsavedChanges])

  const updateSource = useCallback(
    (id: string, dirty: boolean, discard: () => void) => {
      sourcesRef.current.set(id, { dirty, discard })
      synchronizeDirtyState()
    },
    [synchronizeDirtyState]
  )

  const removeSource = useCallback(
    (id: string) => {
      sourcesRef.current.delete(id)
      synchronizeDirtyState()
    },
    [synchronizeDirtyState]
  )

  const requestNavigation = useCallback(
    (action: NavigationAction) => {
      if (!hasUnsavedChanges()) {
        action()
        return
      }

      pendingActionRef.current = action
      setDialogOpen(true)
    },
    [hasUnsavedChanges]
  )

  const discardAndContinue = useCallback((action: NavigationAction) => {
    const dirtySources = Array.from(sourcesRef.current.values()).filter(
      (source) => source.dirty
    )

    for (const source of dirtySources) {
      source.dirty = false
    }

    setHasDirtySources(false)
    setDialogOpen(false)

    for (const source of dirtySources) {
      source.discard()
    }

    action()
  }, [])

  const keepEditing = useCallback(() => {
    pendingActionRef.current = null
    setDialogOpen(false)
  }, [])

  const discardPendingNavigation = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null

    if (action) {
      discardAndContinue(action)
    }
  }, [discardAndContinue])

  useEffect(() => {
    if (!hasDirtySources) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return

      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasDirtySources, hasUnsavedChanges])

  const value = useMemo<DashboardNavigationGuardValue>(
    () => ({
      requestNavigation,
      discardAndContinue,
      hasUnsavedChanges,
      updateSource,
      removeSource,
    }),
    [
      discardAndContinue,
      hasUnsavedChanges,
      removeSource,
      requestNavigation,
      updateSource,
    ]
  )

  return (
    <DashboardNavigationGuardContext.Provider value={value}>
      {children}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) keepEditing()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have changes that have not been saved. Leaving now will
              discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" autoFocus onClick={keepEditing}>
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={discardPendingNavigation}
            >
              Discard and continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardNavigationGuardContext.Provider>
  )
}

/** Registers a dashboard editor's dirty state and its explicit reset action. */
export function useDashboardUnsavedChanges(
  id: string,
  dirty: boolean,
  onDiscard: () => void
) {
  const { updateSource, removeSource } = useContext(
    DashboardNavigationGuardContext
  )
  const discardRef = useRef(onDiscard)

  const discard = useCallback(() => discardRef.current(), [])

  useEffect(() => {
    discardRef.current = onDiscard
  }, [onDiscard])

  useEffect(() => {
    return () => removeSource(id)
  }, [id, removeSource])

  useEffect(() => {
    updateSource(id, dirty, discard)
  }, [dirty, discard, id, updateSource])
}

/** Requests guarded navigation or an explicitly confirmed discard action. */
export function useDashboardNavigationGuard() {
  const { requestNavigation, discardAndContinue, hasUnsavedChanges } =
    useContext(DashboardNavigationGuardContext)

  return {
    requestNavigation,
    discardAndContinue,
    hasUnsavedChanges,
  }
}
