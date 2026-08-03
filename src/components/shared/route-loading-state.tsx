import { AppIcon } from "@/components/shared/app-icon"
import { cn } from "@/lib/utils"

interface RouteLoadingStateProps {
  scope: "app" | "dashboard"
}

/** Branded, accessible loading feedback for route-level Suspense boundaries. */
export function RouteLoadingState({ scope }: RouteLoadingStateProps) {
  const dashboard = scope === "dashboard"

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center px-6 py-16",
        dashboard ? "min-h-[24rem]" : "min-h-screen bg-background"
      )}
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        <AppIcon className="h-12 w-12" />
        <p className="mt-4 text-lg font-semibold text-foreground">OpenSlot</p>
        <div
          className="mt-4 h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm text-muted-foreground">
          {dashboard ? "Loading your dashboard..." : "Loading OpenSlot..."}
        </p>
      </div>
    </div>
  )
}
