"use client";

import { useState } from "react";
import { Clock, Plus, CalendarDays } from "lucide-react";
import {
  AvailabilityDayRow,
  type TimeInterval,
} from "@/components/dashboard/availability-day-row";
import { TimezoneSelector } from "@/components/booking/timezone-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface DayAvailability {
  enabled: boolean;
  intervals: TimeInterval[];
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const defaultAvailability: Record<string, DayAvailability> = {
  Monday: { enabled: true, intervals: [{ start: "09:00", end: "17:00" }] },
  Tuesday: { enabled: true, intervals: [{ start: "09:00", end: "17:00" }] },
  Wednesday: { enabled: true, intervals: [{ start: "09:00", end: "17:00" }] },
  Thursday: { enabled: true, intervals: [{ start: "09:00", end: "17:00" }] },
  Friday: { enabled: true, intervals: [{ start: "09:00", end: "17:00" }] },
  Saturday: { enabled: false, intervals: [] },
  Sunday: { enabled: false, intervals: [] },
};

const mockPreviewSlots = [
  { date: "Mon, Jan 20", time: "9:00 AM" },
  { date: "Mon, Jan 20", time: "10:00 AM" },
  { date: "Mon, Jan 20", time: "11:00 AM" },
  { date: "Tue, Jan 21", time: "9:00 AM" },
  { date: "Tue, Jan 21", time: "2:00 PM" },
];

interface DateOverride {
  id: string;
  date: string;
  available: boolean;
  intervals: TimeInterval[];
}

export default function AvailabilityPage() {
  const { toast } = useToast();
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [availability, setAvailability] =
    useState<Record<string, DayAvailability>>(defaultAvailability);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [newOverrideDate, setNewOverrideDate] = useState("");

  const handleToggle = (day: string, enabled: boolean) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled },
    }));
  };

  const handleIntervalsChange = (day: string, intervals: TimeInterval[]) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], intervals },
    }));
  };

  const handleAddOverride = () => {
    if (!newOverrideDate) return;
    setDateOverrides((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: newOverrideDate,
        available: false,
        intervals: [],
      },
    ]);
    setNewOverrideDate("");
  };

  const handleRemoveOverride = (id: string) => {
    setDateOverrides((prev) => prev.filter((o) => o.id !== id));
  };

  const handleSave = () => {
    toast({
      title: "Availability saved",
      description: "Your availability settings have been updated successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Availability</h1>
          <p className="text-muted-foreground">
            Configure when you&apos;re available for bookings.
          </p>
        </div>
        <Button onClick={handleSave}>Save changes</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly schedule - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timezone selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Timezone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimezoneSelector value={timezone} onChange={setTimezone} />
            </CardContent>
          </Card>

          {/* Weekly availability */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DAYS.map((day) => (
                <AvailabilityDayRow
                  key={day}
                  day={day}
                  enabled={availability[day].enabled}
                  intervals={availability[day].intervals}
                  onToggle={(enabled) => handleToggle(day, enabled)}
                  onIntervalsChange={(intervals) =>
                    handleIntervalsChange(day, intervals)
                  }
                />
              ))}
            </CardContent>
          </Card>

          {/* Date overrides */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Date Overrides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add specific dates with custom availability or mark them as
                unavailable.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="override-date">Date</Label>
                  <Input
                    id="override-date"
                    type="date"
                    value={newOverrideDate}
                    onChange={(e) => setNewOverrideDate(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleAddOverride}
                  disabled={!newOverrideDate}
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Add override
                </Button>
              </div>
              {dateOverrides.length > 0 && (
                <ul className="space-y-2" aria-label="Date overrides">
                  {dateOverrides.map((override) => (
                    <li
                      key={override.id}
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {new Date(override.date).toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                        <Badge variant={override.available ? "success" : "danger"}>
                          {override.available ? "Available" : "Unavailable"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOverride(override.id)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {dateOverrides.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No date overrides set.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview panel */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Next 5 available slots based on your settings:
              </p>
              <ul className="space-y-2" aria-label="Available slot preview">
                {mockPreviewSlots.map((slot, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{slot.date}</span>
                    <span className="text-sm font-medium text-primary">
                      {slot.time}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
