"use client"

import { Button } from "@/components/ui/button"

interface AvailabilitySaveBarProps {
  isSaving: boolean
  saveBlockedReason?: string
  onDiscard: () => void
  onSave: () => void
}

export function AvailabilitySaveBar({
  isSaving,
  saveBlockedReason,
  onDiscard,
  onSave,
}: AvailabilitySaveBarProps) {
  const saveDisabled = isSaving || Boolean(saveBlockedReason)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-3 border-t border-border bg-card px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-2 sm:items-center">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning sm:mt-0"
          aria-hidden="true"
        />
        <div className="text-sm">
          <span className="font-medium text-foreground">
            You have unsaved changes.
          </span>{" "}
          <span className="text-muted-foreground">
            {saveBlockedReason ?? "Save before leaving this page."}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        <Button variant="outline" onClick={onDiscard} disabled={isSaving}>
          Discard
        </Button>
        <Button onClick={onSave} disabled={saveDisabled}>
          {isSaving ? "Saving..." : "Save availability"}
        </Button>
      </div>
    </div>
  )
}
