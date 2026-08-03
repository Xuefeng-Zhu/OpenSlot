'use client'

import { useMemo } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useCopyFeedback } from '@/components/shared/use-copy-feedback'
import { copyTextToClipboard } from '@/lib/utils/clipboard'

/** Builds and copies the signed-in host's public profile booking URL. */
export function useBookingLinkAction(username?: string) {
  const { toast } = useToast()
  const { copied, showCopied } = useCopyFeedback()

  const publicBookingUrl = useMemo(() => {
    const normalizedUsername = username?.replace(/^\/+/, '').trim()
    if (!normalizedUsername) return ''

    const browserOrigin =
      typeof window !== 'undefined' ? window.location.origin : ''
    const configuredOrigin = (
      process.env.NEXT_PUBLIC_APP_URL || ''
    ).replace(/\/+$/, '')
    const origin = browserOrigin || configuredOrigin

    return origin
      ? `${origin}/${normalizedUsername}`
      : `/${normalizedUsername}`
  }, [username])

  const copyBookingLink = async () => {
    if (!publicBookingUrl) return

    try {
      await copyTextToClipboard(publicBookingUrl)
      showCopied()
      toast({
        title: 'Booking link copied',
        description: 'Your public booking page URL is ready to share.',
      })
    } catch {
      toast({
        title: 'Could not copy link',
        description: 'Copy the link from your profile preview instead.',
        variant: 'destructive',
      })
    }
  }

  return {
    copied,
    copyBookingLink,
    publicBookingUrl,
  }
}
