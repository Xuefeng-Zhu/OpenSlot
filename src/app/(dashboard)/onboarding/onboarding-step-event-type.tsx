"use client";

import type * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isVideoProvider } from "@/lib/calendar/video-providers";
import {
  eventLocationPlaceholder,
  eventLocationSelectOptions,
  eventLocationSelectValue,
  isEventLocationType,
} from "@/lib/event-location-options";
import type {
  EventTypeData,
  EventTypeValidationErrors,
} from "./onboarding-steps";

export function StepEventType({
  data,
  errors,
  onChange,
}: {
  data: EventTypeData;
  errors: EventTypeValidationErrors;
  onChange: (data: EventTypeData) => void;
}) {
  const handleLocationSelectChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = event.target.value;

    if (isVideoProvider(value)) {
      onChange({
        ...data,
        locationType: "video_provider",
        locationValue: "",
        videoProvider: value,
      });
      return;
    }

    if (isEventLocationType(value)) {
      onChange({
        ...data,
        locationType: value,
        videoProvider: null,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Create your first event type
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a meeting type that people can book with you.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="eventTitle">Title</Label>
          <Input
            id="eventTitle"
            value={data.title}
            onChange={(event) =>
              onChange({ ...data, title: event.target.value })
            }
            placeholder="30 Minute Meeting"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "eventTitle-error" : undefined}
          />
          {errors.title && (
            <p id="eventTitle-error" className="text-sm text-destructive">
              {errors.title}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventDuration">Duration</Label>
          <Select
            value={data.duration}
            onValueChange={(value) => onChange({ ...data, duration: value })}
          >
            <SelectTrigger id="eventDuration">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="45">45 minutes</SelectItem>
              <SelectItem value="60">60 minutes</SelectItem>
              <SelectItem value="90">90 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventLocationType">Location type</Label>
          <select
            id="eventLocationType"
            value={eventLocationSelectValue(
              data.locationType,
              data.videoProvider
            )}
            onChange={handleLocationSelectChange}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-invalid={!!errors.locationType || !!errors.videoProvider}
            aria-describedby={
              errors.locationType || errors.videoProvider
                ? "eventLocationType-error"
                : undefined
            }
          >
            {eventLocationSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {(errors.locationType || errors.videoProvider) && (
            <p id="eventLocationType-error" className="text-sm text-destructive">
              {errors.locationType ?? errors.videoProvider}
            </p>
          )}
        </div>

        {data.locationType !== "video_provider" && (
          <div className="space-y-2">
            <Label htmlFor="eventLocationValue">Location details</Label>
            <Input
              id="eventLocationValue"
              value={data.locationValue}
              onChange={(event) =>
                onChange({ ...data, locationValue: event.target.value })
              }
              placeholder={eventLocationPlaceholder(data.locationType)}
              aria-invalid={!!errors.locationValue}
              aria-describedby={
                errors.locationValue ? "eventLocationValue-error" : undefined
              }
            />
            {errors.locationValue && (
              <p
                id="eventLocationValue-error"
                className="text-sm text-destructive"
              >
                {errors.locationValue}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
