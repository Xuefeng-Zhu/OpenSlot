import { redirect } from "next/navigation"
import { createServerBackendClient } from "@/lib/backend/server"
import type { Tables } from "@/lib/types/database"
import { AvailabilityClient } from "@/components/dashboard/availability-client"
import { toTimeInputValue } from "@/lib/utils/time"

interface AvailabilityPageProps {
  searchParams?: Promise<{ scheduleId?: string }>
}

export default async function AvailabilityPage({
  searchParams,
}: AvailabilityPageProps) {
  const resolvedSearchParams = await searchParams
  const backendClient = await createServerBackendClient()

  // Get authenticated user
  const {
    data: { user },
  } = await backendClient.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch profile (id, default_timezone) using auth_user_id
  const { data: profileData } = await backendClient
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

  const { data: schedulesData } = await backendClient
    .from("schedules")
    .select("id, name, timezone, is_default, created_at")
    .eq("user_id", profile.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })

  const { data: eventTypeScheduleData } = await backendClient
    .from("event_types")
    .select("id, title, slug, schedule_id")
    .eq("user_id", profile.id)

  const eventTypesBySchedule = new Map<
    string,
    Array<{ id: string; title: string; slug: string }>
  >()
  for (const eventType of eventTypeScheduleData ?? []) {
    const scheduleId = eventType.schedule_id
    const assignedEventTypes = eventTypesBySchedule.get(scheduleId) ?? []
    assignedEventTypes.push({
      id: eventType.id,
      title: eventType.title,
      slug: eventType.slug,
    })
    eventTypesBySchedule.set(scheduleId, assignedEventTypes)
  }

  const schedules = ((schedulesData as Array<Pick<
    Tables<"schedules">,
    "id" | "name" | "timezone" | "is_default" | "created_at"
  >>) ?? []).map((schedule) => ({
    id: schedule.id,
    name: schedule.name,
    timezone: schedule.timezone,
    is_default: schedule.is_default,
    assignedEventTypes: eventTypesBySchedule.get(schedule.id) ?? [],
    assignedEventTypeCount:
      eventTypesBySchedule.get(schedule.id)?.length ?? 0,
  }))

  const selectedSchedule =
    schedules.find(
      (schedule) => schedule.id === resolvedSearchParams?.scheduleId
    ) ??
    schedules.find((schedule) => schedule.is_default) ??
    schedules[0]

  if (!selectedSchedule) {
    redirect("/onboarding")
  }

  // Fetch availability rules for the selected schedule
  const { data: rulesData } = await backendClient
    .from("availability_rules")
    .select("id, weekday, start_time, end_time, is_active")
    .eq("user_id", profile.id)
    .eq("schedule_id", selectedSchedule.id)

  const rules = ((rulesData as Array<Pick<
    Tables<"availability_rules">,
    "id" | "weekday" | "start_time" | "end_time" | "is_active"
  >>) ?? []).map((rule) => ({
    id: rule.id,
    weekday: rule.weekday,
    start_time: toTimeInputValue(rule.start_time) ?? "",
    end_time: toTimeInputValue(rule.end_time) ?? "",
    is_active: rule.is_active,
  }))

  // Fetch availability overrides for the authenticated user
  const { data: overridesData } = await backendClient
    .from("availability_overrides")
    .select("id, date, start_time, end_time, is_available, reason")
    .eq("user_id", profile.id)
    .eq("schedule_id", selectedSchedule.id)

  const overrides = ((overridesData as Array<Pick<
    Tables<"availability_overrides">,
    "id" | "date" | "start_time" | "end_time" | "is_available" | "reason"
  >>) ?? []).map((override) => ({
    id: override.id,
    date: override.date,
    start_time: toTimeInputValue(override.start_time),
    end_time: toTimeInputValue(override.end_time),
    is_available: override.is_available,
    reason: override.reason,
  }))

  return (
    <AvailabilityClient
      schedules={schedules}
      selectedScheduleId={selectedSchedule.id}
      initialRules={rules}
      initialOverrides={overrides}
      timezone={selectedSchedule.timezone || profile.default_timezone || "UTC"}
    />
  )
}
