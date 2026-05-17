"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Clock3 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  BookingPageEventHeader,
  type BookingPageEventHeaderEvent,
  type BookingPageEventHeaderHost,
} from "@/components/booking/booking-page-event-header";
import { cn } from "@/lib/utils";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "Africa/Cairo",
  "Africa/Johannesburg",
];

const DEFAULT_TIMEZONE = "UTC";

interface PublicSchedulePreviewShellProps {
  eventType: BookingPageEventHeaderEvent;
  hostProfile: BookingPageEventHeaderHost;
  unavailableDescription: string;
  layout?: "public" | "embedded";
}

export function PublicSchedulePreviewShell({
  eventType,
  hostProfile,
  unavailableDescription,
  layout = "public",
}: PublicSchedulePreviewShellProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  useEffect(() => {
    try {
      const detectedTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
      setTimezone(detectedTimezone);
    } catch {
      setTimezone(DEFAULT_TIMEZONE);
    }
  }, []);

  const timezoneOptions = COMMON_TIMEZONES.includes(timezone)
    ? COMMON_TIMEZONES
    : [timezone, ...COMMON_TIMEZONES].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl">
      <BookingPageEventHeader
        eventType={eventType}
        hostProfile={hostProfile}
      />

      <div className="mb-6 flex flex-col items-stretch gap-2 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-center">
        <label
          htmlFor="preview-timezone-select"
          className="text-sm font-medium text-foreground"
        >
          Timezone
        </label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger
            className="w-full sm:w-[280px]"
            id="preview-timezone-select"
          >
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezoneOptions.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          layout === "public" && "md:grid-cols-2"
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select a date</CardTitle>
            <CardDescription>
              Choose a date to see available times
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) =>
                date < new Date(new Date().setHours(0, 0, 0, 0))
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available times</CardTitle>
            <CardDescription>
              {selectedDate
                ? format(selectedDate, "EEEE, MMMM d, yyyy")
                : "Select a date to view available times"}
            </CardDescription>
          </CardHeader>
          <CardContent aria-live="polite">
            {!selectedDate ? (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
                heading="Choose a date"
                description="Pick an available date from the calendar to see times in your timezone."
                className="border-0 bg-muted/30 py-10"
              />
            ) : (
              <EmptyState
                icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}
                heading="Live availability unavailable"
                description={unavailableDescription}
                className="border-0 bg-muted/30 py-10"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
