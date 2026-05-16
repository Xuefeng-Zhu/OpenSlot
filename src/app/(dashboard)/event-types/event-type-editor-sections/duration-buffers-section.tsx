import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventTypeSectionProps } from "./event-type-section-types";

export function DurationBuffersSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input
          id="duration"
          type="number"
          value={values.duration_minutes}
          onChange={(event) => {
            onFieldChange("duration_minutes", Number(event.target.value));
            clearFieldError("duration_minutes");
          }}
          min={1}
          max={480}
        />
        {errors.duration_minutes ? (
          <p className="text-xs text-destructive mt-1">
            {errors.duration_minutes}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="buffer-before">Buffer before (min)</Label>
          <Input
            id="buffer-before"
            type="number"
            value={values.buffer_before_minutes}
            onChange={(event) => {
              onFieldChange("buffer_before_minutes", Number(event.target.value));
              clearFieldError("buffer_before_minutes");
            }}
            min={0}
          />
          {errors.buffer_before_minutes ? (
            <p className="text-xs text-destructive mt-1">
              {errors.buffer_before_minutes}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="buffer-after">Buffer after (min)</Label>
          <Input
            id="buffer-after"
            type="number"
            value={values.buffer_after_minutes}
            onChange={(event) => {
              onFieldChange("buffer_after_minutes", Number(event.target.value));
              clearFieldError("buffer_after_minutes");
            }}
            min={0}
          />
          {errors.buffer_after_minutes ? (
            <p className="text-xs text-destructive mt-1">
              {errors.buffer_after_minutes}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
