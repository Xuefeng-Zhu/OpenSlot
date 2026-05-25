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
import { EmptyState } from "@/components/shared/empty-state";
import {
  BookingPageEventHeader,
  type BookingPageEventHeaderEvent,
  type BookingPageEventHeaderHost,
} from "@/components/booking/booking-page-event-header";
import { SlotPickerTimezoneControl } from "@/components/booking/slot-picker-timezone-control";
import { cn } from "@/lib/utils";
import {
  browserTimezoneOrDefault,
  DEFAULT_TIMEZONE,
} from "@/lib/utils/timezone";

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
    setTimezone(browserTimezoneOrDefault());
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <BookingPageEventHeader
        eventType={eventType}
        hostProfile={hostProfile}
      />

      <SlotPickerTimezoneControl
        timezone={timezone}
        onTimezoneChange={setTimezone}
      />

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
