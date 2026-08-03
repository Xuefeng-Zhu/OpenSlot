"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { AvailabilityPageHeader } from "@/components/dashboard/availability-page-header"
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json"
import { useToast } from "@/components/ui/use-toast"

interface AvailabilityNoSchedulesStateProps {
  timezone: string
}

interface CreateScheduleResponse {
  schedule: { id: string; name: string }
}

/** Genuine empty state for profiles whose availability schedules were removed. */
export function AvailabilityNoSchedulesState({
  timezone,
}: AvailabilityNoSchedulesStateProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)

  async function createSchedule() {
    if (creating) return
    setCreating(true)

    try {
      const { schedule } = await requestJson<CreateScheduleResponse>(
        "/api/availability/schedules",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Working hours", timezone }),
        },
        "Failed to create an availability schedule"
      )
      toast({
        title: "Schedule created",
        description: "Working hours are ready to configure.",
      })
      router.push(`/availability?scheduleId=${schedule.id}`)
      router.refresh()
    } catch (error) {
      toast({
        title: "Could not create schedule",
        description: errorToastDescription(error),
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <AvailabilityPageHeader />
      <EmptyState
        icon={<CalendarClock className="h-6 w-6" aria-hidden="true" />}
        heading="No availability schedules"
        headingLevel={2}
        description="Create a schedule to add the booking hours used by your event types."
        action={{
          label: creating ? "Creating schedule..." : "Create schedule",
          onClick: createSchedule,
        }}
      />
    </div>
  )
}
