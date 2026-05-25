"use client";

import { AvailabilityDayRow } from "@/components/dashboard/availability-day-row";
import type {
  AvailabilityData,
  AvailabilityValidationErrors,
  DayAvailability,
} from "./onboarding-steps";

export function StepAvailability({
  data,
  errors,
  onDayChange,
}: {
  data: AvailabilityData;
  errors: AvailabilityValidationErrors;
  onDayChange: (
    day: keyof AvailabilityData,
    updates: Partial<DayAvailability>
  ) => void;
}) {
  const days: { key: keyof AvailabilityData; label: string }[] = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Set your availability
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define when you&apos;re available for bookings. You can change this
          later.
        </p>
        {errors.general && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {errors.general}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {days.map(({ key, label }) => (
          <AvailabilityDayRow
            key={key}
            day={label}
            enabled={data[key].enabled}
            intervals={data[key].intervals}
            onToggle={(enabled) => onDayChange(key, { enabled })}
            onIntervalsChange={(intervals) => onDayChange(key, { intervals })}
            error={errors.days[key]}
          />
        ))}
      </div>
    </div>
  );
}
