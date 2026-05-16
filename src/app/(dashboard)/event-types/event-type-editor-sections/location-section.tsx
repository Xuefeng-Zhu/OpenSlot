import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  locationPlaceholder,
  type VideoProviderHealth,
} from "../event-type-editor-model";
import type { EventTypeSectionProps } from "./event-type-section-types";

interface LocationSectionProps extends EventTypeSectionProps {
  selectedVideoHealth: VideoProviderHealth | null;
  onLocationSelectChange: (value: string) => void;
}

export function LocationSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
  selectedVideoHealth,
  onLocationSelectChange,
}: LocationSectionProps) {
  const locationSelectValue =
    values.location_type === "video_provider"
      ? values.video_provider ?? "google_meet"
      : values.location_type;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="location-type">Location type</Label>
        <select
          id="location-type"
          value={locationSelectValue}
          onChange={(event) => onLocationSelectChange(event.target.value)}
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="custom">Custom link</option>
          <option value="phone">Phone</option>
          <option value="in_person">In Person</option>
          <option value="google_meet">Google Meet</option>
          <option value="microsoft_teams">Microsoft Teams</option>
          <option value="online">Online (manual)</option>
        </select>
        {errors.location_type ? (
          <p className="text-xs text-destructive mt-1">
            {errors.location_type}
          </p>
        ) : null}
        {errors.video_provider ? (
          <p className="text-xs text-destructive mt-1">
            {errors.video_provider}
          </p>
        ) : null}
        {selectedVideoHealth ? (
          <p
            className={`mt-2 text-xs ${
              selectedVideoHealth.ready ? "text-success" : "text-amber-600"
            }`}
          >
            {selectedVideoHealth.message}
          </p>
        ) : null}
      </div>
      {values.location_type !== "video_provider" ? (
        <div>
          <Label htmlFor="location-value">Location details</Label>
          <Input
            id="location-value"
            value={values.location_value}
            onChange={(event) => {
              onFieldChange("location_value", event.target.value);
              clearFieldError("location_value");
            }}
            placeholder={locationPlaceholder(values.location_type)}
          />
          {errors.location_value ? (
            <p className="text-xs text-destructive mt-1">
              {errors.location_value}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
