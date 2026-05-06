import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/types/database"
import { AvailabilityClient } from "@/components/dashboard/availability-client"

export default async function AvailabilityPage() {
  const supabase = await createServerSupabaseClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch profile (id, default_timezone) using auth_user_id
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, default_timezone")
    .eq("auth_user_id", user.id)
    .single()

  const profile = profileData as Pick<
    Tables<"profiles">,
    "id" | "default_timezone"
  > | null

  if (!profile) {
    redirect("/onboarding")
  }

  // Fetch availability rules for the authenticated user
  const { data: rulesData } = await supabase
    .from("availability_rules")
    .select("id, weekday, start_time, end_time, is_active")
    .eq("user_id", profile.id)

  const rules = ((rulesData as Array<Pick<
    Tables<"availability_rules">,
    "id" | "weekday" | "start_time" | "end_time" | "is_active"
  >>) ?? []).map((rule) => ({
    id: rule.id,
    weekday: rule.weekday,
    start_time: rule.start_time,
    end_time: rule.end_time,
    is_active: rule.is_active,
  }))

  // Fetch availability overrides for the authenticated user
  const { data: overridesData } = await supabase
    .from("availability_overrides")
    .select("id, date, start_time, end_time, is_available, reason")
    .eq("user_id", profile.id)

  const overrides = ((overridesData as Array<Pick<
    Tables<"availability_overrides">,
    "id" | "date" | "start_time" | "end_time" | "is_available" | "reason"
  >>) ?? []).map((override) => ({
    id: override.id,
    date: override.date,
    start_time: override.start_time,
    end_time: override.end_time,
    is_available: override.is_available,
    reason: override.reason,
  }))

  // Use profile's default_timezone, fallback to UTC
  const timezone = profile.default_timezone || "UTC"

  return (
    <AvailabilityClient
      initialRules={rules}
      initialOverrides={overrides}
      timezone={timezone}
      userId={profile.id}
    />
  )
}
