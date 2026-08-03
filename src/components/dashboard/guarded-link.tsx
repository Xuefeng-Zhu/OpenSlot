"use client"

import { forwardRef, type ComponentProps } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDashboardNavigationGuard } from "@/components/dashboard/navigation-guard-provider"

type GuardedLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onNavigate"
> & {
  href: string
  navigationMode?: "client" | "document"
  onNavigationAccepted?: () => void
}

/**
 * Uses Next's supported onNavigate interception so dashboard links respect the
 * shared unsaved-change guard without modifying browser history.
 */
export const GuardedLink = forwardRef<HTMLAnchorElement, GuardedLinkProps>(
  function GuardedLink(
    {
      href,
      navigationMode = "client",
      onNavigationAccepted,
      replace,
      scroll,
      ...props
    },
    ref
  ) {
    const router = useRouter()
    const { requestNavigation, hasUnsavedChanges } =
      useDashboardNavigationGuard()

    return (
      <Link
        ref={ref}
        href={href}
        replace={replace}
        scroll={scroll}
        onNavigate={(event) => {
          const needsDocumentNavigation = navigationMode === "document"
          if (!needsDocumentNavigation && !hasUnsavedChanges()) {
            onNavigationAccepted?.()
            return
          }

          event.preventDefault()
          requestNavigation(() => {
            onNavigationAccepted?.()

            if (needsDocumentNavigation) {
              window.location.assign(href)
            } else if (replace) {
              router.replace(href, { scroll })
            } else {
              router.push(href, { scroll })
            }
          })
        }}
        {...props}
      />
    )
  }
)
