import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'
import {
  getBrowserCookies,
  setBrowserCookies,
} from '@/lib/supabase/auth-cookie-persistence'

type CreateClientOptions = {
  keepSignedIn?: boolean
}

/**
 * Creates the browser Supabase client with the public anon key.
 * Use this for authenticated client-side Auth operations only; privileged table
 * writes should go through route handlers.
 */
export function createClient(options: CreateClientOptions = {}) {
  const useCustomAuthCookies = options.keepSignedIn !== undefined

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    useCustomAuthCookies
      ? {
          isSingleton: false,
          cookies: {
            getAll: getBrowserCookies,
            setAll: (cookiesToSet) =>
              setBrowserCookies(cookiesToSet, options.keepSignedIn ?? true),
          },
        }
      : undefined
  )
}
