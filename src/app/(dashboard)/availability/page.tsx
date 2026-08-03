import { notFound, redirect } from "next/navigation"
import { createServerBackendClient } from "@/lib/backend/server"
import {
  optionalPageRow,
  pageCollection,
  pageUserOrNull,
} from "@/lib/backend/page-data"
import type { Tables } from "@/lib/types/database"
import { AvailabilityClient } from "@/components/dashboard/availability-client"
import { AvailabilityNoSchedulesState } from "@/components/dashboard/availability-no-schedules-state"
import { toDateInputValue, toTimeInputValue } from "@/lib/utils/time"
import { routeMetadata } from "@/app/route-metadata"

export const metadata = routeMetadata.availability

interface AvailabilityPageProps {
  searchParams?: Promise<{ scheduleId?: string }>
}

export default async function AvailabilityPage({
  searchParams,
}: AvailabilityPageProps) {
  const resolvedSearchParams = await searchParams
  const backendClient = await createServerBackendClient()

  const user = pageUserOrNull(await backendClient.auth.getUser())

  if (!user) {
    redirect("/login")
  }

  const profile = optionalPageRow(
    await backendClient
      .from("profiles")
      .select("id, default_timezone")
      .eq("auth_user_id", user.id)
      .single(),
    "dashboard profile"
  ) as Pick<Tables<"profiles">, "id" | "default_timezone"> | null

  if (!profile) {
    redirect("/onboarding")
  }

  const [schedulesResult, eventTypeSchedulesResult] = await Promise.all([
    backendClient
      .from("schedules")
      .select("id, name, timezone, is_default, created_at, updated_at")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    backendClient
      .from("event_types")
      .select("id, title, slug, schedule_id")
      .eq("user_id", profile.id),
  ])

  const eventTypeScheduleData = pageCollection(
    eventTypeSchedulesResult,
    "event type schedules"
  ) as Array<Pick<Tables<"event_types">, "id" | "title" | "slug" | "schedule_id">>

  const eventTypesBySchedule = new Map<
    string,
    Array<{ id: string; title: string; slug: string }>
  >()
  for (const eventType of eventTypeScheduleData) {
    const scheduleId = eventType.schedule_id
    const assignedEventTypes = eventTypesBySchedule.get(scheduleId) ?? []
    assignedEventTypes.push({
      id: eventType.id,
      title: eventType.title,
      slug: eventType.slug,
    })
    eventTypesBySchedule.set(scheduleId, assignedEventTypes)
  }

  const schedulesData = pageCollection(
    schedulesResult,
    "availability schedules"
  ) as Array<Pick<
    Tables<"schedules">,
    "id" | "name" | "timezone" | "is_default" | "created_at" | "updated_at"
  >>
  const schedules = schedulesData.map((schedule) => ({
    id: schedule.id,
    name: schedule.name,
    timezone: schedule.timezone,
    is_default: schedule.is_default,
    updated_at: schedule.updated_at,
    assignedEventTypes: eventTypesBySchedule.get(schedule.id) ?? [],
    assignedEventTypeCount:
      eventTypesBySchedule.get(schedule.id)?.length ?? 0,
  }))

  const requestedScheduleId = resolvedSearchParams?.scheduleId
  const requestedSchedule = requestedScheduleId
    ? schedules.find((schedule) => schedule.id === requestedScheduleId)
    : undefined

  if (requestedScheduleId && !requestedSchedule) {
    notFound()
  }

  const selectedSchedule =
    requestedSchedule ??
    schedules.find((schedule) => schedule.is_default) ??
    schedules[0]

  if (!selectedSchedule) {
    return (
      <AvailabilityNoSchedulesState
        timezone={profile.default_timezone || "UTC"}
      />
    )
  }

  const [rulesResult, overridesResult] = await Promise.all([
    backendClient
      .from("availability_rules")
      .select("id, weekday, start_time, end_time, is_active")
      .eq("user_id", profile.id)
      .eq("schedule_id", selectedSchedule.id),
    backendClient
      .from("availability_overrides")
      .select("id, date, start_time, end_time, is_available, reason")
      .eq("user_id", profile.id)
      .eq("schedule_id", selectedSchedule.id),
  ])

  const rulesData = pageCollection(
    rulesResult,
    "availability rules"
  ) as Array<Pick<
    Tables<"availability_rules">,
    "id" | "weekday" | "start_time" | "end_time" | "is_active"
  >>
  const rules = rulesData.map((rule) => ({
    id: rule.id,
    weekday: rule.weekday,
    start_time: toTimeInputValue(rule.start_time) ?? "",
    end_time: toTimeInputValue(rule.end_time) ?? "",
    is_active: rule.is_active,
  }))

  const overridesData = pageCollection(
    overridesResult,
    "availability overrides"
  ) as Array<Pick<
    Tables<"availability_overrides">,
    "id" | "date" | "start_time" | "end_time" | "is_available" | "reason"
  >>
  const overrides = overridesData.map((override) => ({
    id: override.id,
    date: toDateInputValue(override.date) ?? "",
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
      initialScheduleUpdatedAt={selectedSchedule.updated_at}
      timezone={selectedSchedule.timezone || profile.default_timezone || "UTC"}
    />
  )
}
