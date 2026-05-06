"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Globe2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

interface AvailabilityRow {
  day: string;
  enabled: boolean;
  intervals: Array<[string, string]>;
}

const defaultRows: AvailabilityRow[] = [
  { day: "Monday", enabled: true, intervals: [["9:00 AM", "12:00 PM"], ["2:00 PM", "5:00 PM"]] },
  { day: "Tuesday", enabled: true, intervals: [["9:00 AM", "12:00 PM"], ["1:00 PM", "4:00 PM"]] },
  { day: "Wednesday", enabled: true, intervals: [["9:00 AM", "12:00 PM"]] },
  { day: "Thursday", enabled: true, intervals: [["1:00 PM", "5:00 PM"]] },
  { day: "Friday", enabled: true, intervals: [["9:00 AM", "1:00 PM"]] },
  { day: "Saturday", enabled: false, intervals: [] },
  { day: "Sunday", enabled: false, intervals: [] },
];

const previewSlots = [
  { day: "Mon, May 26", slots: ["10:00 AM", "11:00 AM", "2:00 PM"] },
  { day: "Tue, May 27", slots: [] },
  { day: "Wed, May 28", slots: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM"] },
  { day: "Thu, May 29", slots: ["1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"] },
  { day: "Fri, May 30", slots: ["9:00 AM", "10:00 AM", "11:00 AM"] },
  { day: "Sat, May 31", slots: [] },
  { day: "Sun, Jun 1", slots: [] },
];

export default function AvailabilityPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState(defaultRows);

  const handleToggle = (index: number, enabled: boolean) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, enabled } : row
      )
    );
  };

  const handleSave = () => {
    toast({
      title: "Availability saved",
      description: "Your booking availability has been updated.",
    });
  };

  return (
    <div className="mx-auto max-w-[1220px] space-y-6 pb-20">
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span>Dashboard</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span className="font-bold text-foreground">Availability</span>
        </div>
        <h1 className="text-3xl font-extrabold text-foreground">Availability</h1>
        <p className="mt-2 text-base font-medium text-muted-foreground">
          Set your regular weekly availability and date overrides.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="bg-white">
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">
                    Weekly availability
                  </h2>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Set when you are regularly available for bookings.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-3 rounded-[10px] border border-border bg-white px-4 text-sm font-bold text-foreground shadow-sm"
                >
                  <Globe2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-left">
                    <span className="block text-xs text-muted-foreground">Timezone</span>
                    America/New_York (EDT)
                  </span>
                </button>
              </div>

              <div>
                {rows.map((row, index) => (
                  <div
                    key={row.day}
                    className="grid gap-4 border-b border-border px-6 py-4 last:border-b-0 lg:grid-cols-[120px_52px_1fr_auto]"
                  >
                    <p className="text-sm font-bold text-foreground">{row.day}</p>
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(enabled) => handleToggle(index, enabled)}
                      aria-label={`Toggle ${row.day} availability`}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      {row.enabled ? (
                        row.intervals.map(([start, end], intervalIndex) => (
                          <div
                            key={`${row.day}-${start}-${end}`}
                            className="flex items-center gap-3"
                          >
                            <TimePill value={start} />
                            <span className="text-muted-foreground">-</span>
                            <TimePill value={end} />
                            {intervalIndex < row.intervals.length - 1 && (
                              <span className="hidden text-border lg:block">|</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {row.enabled && (
                        <Button variant="ghost" size="icon" aria-label={`Delete ${row.day} interval`}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" disabled={!row.enabled}>
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Add interval
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">
                    Date overrides
                  </h2>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Create exceptions to your regular weekly availability.
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add override
                </Button>
              </div>

              <div className="overflow-hidden rounded-[14px] border border-border">
                <OverrideRow
                  month="MAY"
                  day="27"
                  weekday="WED"
                  title="May 27, 2026"
                  status="Unavailable"
                />
                <OverrideRow
                  month="JUN"
                  day="4"
                  weekday="THU"
                  title="June 4, 2026"
                  status="Special hours"
                  time="9:00 AM - 12:00 PM"
                  special
                />
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                Showing 2 of 2 overrides
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit bg-white xl:sticky xl:top-24">
          <CardContent className="p-6">
            <h2 className="text-lg font-extrabold text-foreground">
              Next available slots
            </h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Preview of upcoming availability.
            </p>
            <Button variant="outline" size="sm" className="mt-5">
              <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
              Upcoming 7 days
            </Button>
            <div className="mt-6 divide-y divide-border">
              {previewSlots.map((day) => (
                <div key={day.day} className="py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold text-foreground">{day.day}</p>
                    {day.slots.length > 0 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  {day.slots.length > 0 ? (
                    <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm font-medium text-muted-foreground">
                      {day.slots.map((slot) => (
                        <span key={`${day.day}-${slot}`}>{slot}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-medium text-muted-foreground">
                      Unavailable
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm font-medium leading-6 text-muted-foreground">
              All times shown in America/New_York (EDT)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-5 py-4 shadow-lg backdrop-blur sm:px-8 lg:pl-[320px] lg:pr-10">
        <div className="mx-auto flex max-w-[1220px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 rounded-full bg-warning" />
            <div>
              <p className="text-sm font-extrabold text-foreground">
                You have unsaved changes
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                Do not forget to save your availability.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">Discard</Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              Save availability
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimePill({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 min-w-[104px] items-center justify-between rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-foreground shadow-sm"
    >
      {value}
      <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function OverrideRow({
  month,
  day,
  weekday,
  title,
  status,
  time,
  special,
}: {
  month: string;
  day: string;
  weekday: string;
  title: string;
  status: string;
  time?: string;
  special?: boolean;
}) {
  return (
    <div className="grid gap-4 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[56px_1fr_auto_auto] sm:items-center">
      <div className="text-center">
        <p className="text-xs font-extrabold text-destructive">{month}</p>
        <p className="text-2xl font-extrabold leading-none text-foreground">{day}</p>
        <p className="text-xs font-bold text-muted-foreground">{weekday}</p>
      </div>
      <div>
        <p className="font-extrabold text-foreground">{title}</p>
        <p className="text-sm font-medium text-muted-foreground">{status}</p>
      </div>
      <Badge variant={special ? "default" : "secondary"}>{status}</Badge>
      <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
        {time && <span>{time}</span>}
        <Button variant="outline" size="icon" aria-label={`Edit ${title}`}>
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="icon" aria-label={`Delete ${title}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
