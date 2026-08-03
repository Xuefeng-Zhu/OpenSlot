"use client"

import { RouteErrorState } from "@/components/shared/route-error-state"

interface RootErrorProps {
  error: Error & { digest?: string }
  unstable_retry: () => void
}

export default function RootError({ unstable_retry }: RootErrorProps) {
  return <RouteErrorState scope="app" onRetry={unstable_retry} />
}
