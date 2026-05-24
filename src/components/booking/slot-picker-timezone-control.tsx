"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { timezoneOptionsWithCurrent } from "@/lib/utils/timezone";

interface SlotPickerTimezoneControlProps {
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
}

export function SlotPickerTimezoneControl({
  timezone,
  onTimezoneChange,
}: SlotPickerTimezoneControlProps) {
  const timezoneOptions = timezoneOptionsWithCurrent(timezone);

  return (
    <div className="mb-6 flex flex-col items-stretch gap-2 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-center">
      <label
        htmlFor="timezone-select"
        className="text-sm font-medium text-foreground"
      >
        Timezone
      </label>
      <Select value={timezone} onValueChange={onTimezoneChange}>
        <SelectTrigger className="w-full sm:w-[280px]" id="timezone-select">
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
  );
}
