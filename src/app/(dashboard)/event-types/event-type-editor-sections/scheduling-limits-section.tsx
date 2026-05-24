import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventTypeSectionProps } from "./event-type-section-types";
import type { ScheduleOption } from "../event-type-editor";

interface SchedulingLimitsSectionProps extends EventTypeSectionProps {
  schedules: ScheduleOption[];
}

export function SchedulingLimitsSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
  schedules,
}: SchedulingLimitsSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="schedule">Availability schedule</Label>
        <Select
          value={values.schedule_id}
          onValueChange={(value) => {
            onFieldChange("schedule_id", value);
            clearFieldError("schedule_id");
          }}
        >
          <SelectTrigger
            id="schedule"
            aria-label="Availability schedule"
            aria-invalid={!!errors.schedule_id}
            aria-describedby={
              errors.schedule_id ? "schedule-error" : undefined
            }
          >
            <SelectValue placeholder="Choose a schedule" />
          </SelectTrigger>
          <SelectContent>
            {schedules.map((schedule) => (
              <SelectItem key={schedule.id} value={schedule.id}>
                {schedule.name}
                {schedule.is_default ? " (default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.schedule_id ? (
          <p id="schedule-error" className="text-xs text-destructive mt-1">
            {errors.schedule_id}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="min-notice">Minimum notice (minutes)</Label>
        <Input
          id="min-notice"
          type="number"
          value={values.min_notice_minutes}
          onChange={(event) => {
            onFieldChange("min_notice_minutes", Number(event.target.value));
            clearFieldError("min_notice_minutes");
          }}
          min={0}
          aria-invalid={!!errors.min_notice_minutes}
          aria-describedby={
            errors.min_notice_minutes ? "min-notice-error" : undefined
          }
        />
        {errors.min_notice_minutes ? (
          <p id="min-notice-error" className="text-xs text-destructive mt-1">
            {errors.min_notice_minutes}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="max-days">Max days ahead</Label>
        <Input
          id="max-days"
          type="number"
          value={values.max_booking_days_ahead}
          onChange={(event) => {
            onFieldChange("max_booking_days_ahead", Number(event.target.value));
            clearFieldError("max_booking_days_ahead");
          }}
          min={1}
          aria-invalid={!!errors.max_booking_days_ahead}
          aria-describedby={
            errors.max_booking_days_ahead ? "max-days-error" : undefined
          }
        />
        {errors.max_booking_days_ahead ? (
          <p id="max-days-error" className="text-xs text-destructive mt-1">
            {errors.max_booking_days_ahead}
          </p>
        ) : null}
      </div>
    </div>
  );
}
