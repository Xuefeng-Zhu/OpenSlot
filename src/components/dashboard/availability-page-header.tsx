import { PageHeader } from "@/components/dashboard/page-header"

/** Shared visible page heading for every Availability data state. */
export function AvailabilityPageHeader() {
  return (
    <PageHeader
      title="Availability"
      description="Manage the weekly hours and date-specific changes used by your event types."
    />
  )
}
