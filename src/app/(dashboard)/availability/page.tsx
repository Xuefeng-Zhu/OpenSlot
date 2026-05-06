"use client";

import { useState } from "react";
import { Clock, Plus, CalendarDays, Pencil, Trash2, ChevronRight } from "lucide-react";
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
  Monday: { enabled: true, intervals: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }] },
  Tuesday: { enabled: true, intervals: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "16:00" }] },
  Wednesday: { enabled: true, intervals: [{ start: "09:00", end: "12:00" }] },
  Thursday: { enabled: true, intervals: [{ start: "13:00", end: "17:00" }] },
  Friday: { enabled: true, intervals: [{ start: "09:00", end: "13:00" }] },
  Saturday: { enabled: false, intervals: [] },
  Sunday: { enabled: false, intervals: [] },
};

const mockPreviewSlots = [
  { date: "Mon, May 26", times: ["10:00 AM", "11:00 AM", "2:00 PM"] },
  { date: "Tue, May 27", times: [] },
  { date: "Wed, May 28", times: ["9:00 AM", "10:00 AM", "11:00 AM"] },
  { date: "Thu, May 29", times: ["1:00 PM", "2:00 PM", "3:00 PM"] },
  { date: "Fri, May 30", times: ["9:00 AM", "10:00 AM", "11:00 AM"] },
  { date: "Sat, May 31", times: [] },
  { date: "Sun, Jun 1", times: [] },
];

interface DateOverride {
  id: string;
  date: string;
  label: string;
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
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([
    { id: "1", date: "2026-05-27", label: "May 27, 2026", available: false, intervals: [] },
    { id: "2", date: "2026-06-04", label: "June 4, 2026", available: true, intervals: [{ start: "09:00", end: "12:00" }] },
  ]);
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (day: string, enabled: boolean) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled },
    }));
    setHasChanges(true);
  };

  const handleIntervalsChange = (day: string, intervals: TimeInterval[]) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], intervals },
    }));
    setHasChanges(true);
  };

  const handleAddOverride = () => {
    if (!newOverrideDate) return;
    const dateObj = new Date(newOverrideDate);
    setDateOverrides((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: newOverrideDate,
        label: dateObj.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
        available: false,
        intervals: [],
      },
    ]);
    setNewOverrideDate("");
    setHasChanges(true);
  };

  const handleRemoveOverride = (id: string) => {
    setDateOverrides((prev) => prev.filter((o) => o.id !== id));
    setHasChanges(true);
  };

  const handleSave = () => {
    toast({
      title: "Availability saved",
      description: "Your availability settings have been updated successfully.",
    });
    setHasChanges(false);
  };

  const handleDiscard = () => {
    setAvailability(defaultAvailability);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        Dashboard &gt; <span className="text-foreground font-medium">Availability</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Availability</h1>
        <p className="text-muted-foreground">
          Set your regular weekly availability and date overrides.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly schedule - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly availability */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Weekly availability</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Set when you&apos;re regularly available for bookings.</p>
              </div>
              {/* Timezone selector inline */}
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div className="text-xs">
                  <span className="text-muted-foreground">Timezone</span>
                  <br />
                  <span className="font-medium text-foreground">{timezone.replace(/_/g, " ")}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Date overrides</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Create exceptions to your regular weekly availability.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOverride}
                disabled={!newOverrideDate}
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                Add override
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="override-date" className="sr-only">Date</Label>
                  <Input
                    id="override-date"
                    type="date"
                    value={newOverrideDate}
                    onChange={(e) => setNewOverrideDate(e.target.value)}
                  />
                </div>
              </div>

              {dateOverrides.length > 0 && (
                <ul className="space-y-2" aria-label="Date overrides">
                  {dateOverrides.map((override) => (
                    <li
                      key={override.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center rounded bg-accent px-2 py-1 text-center">
                          <span className="text-[10px] font-medium text-primary uppercase">
                            {new Date(override.date).toLocaleDateString(undefined, { month: "short" })}
                          </span>
                          <span className="text-lg font-bold text-foreground leading-none">
                            {new Date(override.date).getDate()}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {new Date(override.date).toLocaleDateString(undefined, { weekday: "short" })}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{override.label}</p>
                          <Badge variant={override.available ? "outline" : "secondary"} className="mt-0.5">
                            {override.available ? "Special hours" : "Unavailable"}
                          </Badge>
                          {override.available && override.intervals.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {override.intervals.map(i => `${i.start} – ${i.end}`).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit override">
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveOverride(override.id)}
                          aria-label="Remove override"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {dateOverrides.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Showing {dateOverrides.length} of {dateOverrides.length} overrides
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel - Next available slots */}
        <div>
          <Card className="sticky top-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Next available slots</CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-md px-2 py-1">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                Upcoming 7 days
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Preview of upcoming availability.
              </p>
              <ul className="space-y-2" aria-label="Available slot preview">
                {mockPreviewSlots.map((slot, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{slot.date}</p>
                      {slot.times.length > 0 ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {slot.times.join("  ")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Unavailable</p>
                      )}
                    </div>
                    {slot.times.length > 0 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                All times shown in {timezone.replace(/_/g, " ")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">You have unsaved changes</span>
            <span className="text-sm text-muted-foreground">Don&apos;t forget to save your availability.</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleDiscard}>Discard</Button>
            <Button onClick={handleSave}>Save availability</Button>
          </div>
        </div>
      )}
    </div>
  );
}
