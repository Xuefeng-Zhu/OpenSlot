"use client"

import { RouteErrorState } from "@/components/shared/route-error-state"

interface DashboardErrorProps {
  error: Error & { digest?: string }
  unstable_retry: () => void
}

export default function DashboardError({
  unstable_retry,
}: DashboardErrorProps) {
  return <RouteErrorState scope="dashboard" onRetry={unstable_retry} />
}
