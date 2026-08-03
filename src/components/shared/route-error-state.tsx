import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RouteErrorStateProps {
  scope: "app" | "dashboard"
  onRetry: () => void
}

/** Generic recovery UI that intentionally omits provider and database details. */
export function RouteErrorState({ scope, onRetry }: RouteErrorStateProps) {
  const dashboard = scope === "dashboard"

  return (
    <div
      role="alert"
      className={
        dashboard
          ? "flex min-h-[24rem] items-center justify-center px-4 py-12"
          : "flex min-h-screen items-center justify-center bg-background px-6 py-16"
      }
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          aria-hidden="true"
        >
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
          {dashboard ? "We couldn't load this dashboard page" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your data is still safe. Try loading the page again.
        </p>
        <Button type="button" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}
