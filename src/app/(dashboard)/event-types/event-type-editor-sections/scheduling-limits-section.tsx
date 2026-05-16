import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventTypeSectionProps } from "./event-type-section-types";

export function SchedulingLimitsSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
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
        />
        {errors.min_notice_minutes ? (
          <p className="text-xs text-destructive mt-1">
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
        />
        {errors.max_booking_days_ahead ? (
          <p className="text-xs text-destructive mt-1">
            {errors.max_booking_days_ahead}
          </p>
        ) : null}
      </div>
    </div>
  );
}
