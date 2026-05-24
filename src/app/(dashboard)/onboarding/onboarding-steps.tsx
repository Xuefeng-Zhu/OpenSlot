"use client";

import type * as React from "react";
import Link from "next/link";
import { Calendar, Check, Copy, FileText, Link2, User } from "lucide-react";
import {
  AvailabilityDayRow,
  type TimeInterval,
} from "@/components/dashboard/availability-day-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defaultVideoProvider,
  isVideoProvider,
  videoProviderOptions,
  type VideoProvider,
} from "@/lib/calendar/video-providers";
import { cn } from "@/lib/utils";
import type { EventLocationType } from "@/lib/validations/event-type";

export const ONBOARDING_STEPS = [
  { label: "Create public profile", icon: User },
  { label: "Set availability", icon: Calendar },
  { label: "Create first event type", icon: FileText },
  { label: "Share booking link", icon: Link2 },
] as const;

export interface ProfileData {
  displayName: string;
  username: string;
}

export interface DayAvailability {
  enabled: boolean;
  intervals: TimeInterval[];
}

export interface AvailabilityData {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export interface EventTypeData {
  title: string;
  duration: string;
  locationType: EventLocationType;
  locationValue: string;
  videoProvider: VideoProvider | null;
}

export interface ProfileValidationErrors {
  displayName?: string;
  username?: string;
}

export interface AvailabilityValidationErrors {
  general?: string;
  days: Partial<Record<keyof AvailabilityData, string>>;
}

export interface EventTypeValidationErrors {
  title?: string;
  locationType?: string;
  locationValue?: string;
  videoProvider?: string;
}

function isLocationType(value: string): value is EventLocationType {
  return ["online", "phone", "in_person", "custom", "video_provider"].includes(
    value
  );
}

function getLocationSelectValue(data: EventTypeData) {
  if (data.locationType === "video_provider") {
    return data.videoProvider ?? defaultVideoProvider;
  }

  return data.locationType;
}

function getLocationPlaceholder(locationType: EventLocationType) {
  if (locationType === "phone") return "e.g. +1 555 123 4567";
  if (locationType === "in_person") return "e.g. 123 Market Street";
  if (locationType === "custom") return "e.g. https://example.com/meeting";
  return "e.g. Online meeting details";
}

export function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Onboarding progress">
      <ol className="hidden md:flex items-center justify-between">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const Icon = step.icon;
          return (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isActive && "border-primary bg-accent text-primary",
                    !isCompleted &&
                      !isActive &&
                      "border-border bg-background text-muted-foreground"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs text-center max-w-[100px]",
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < ONBOARDING_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 self-start mt-5",
                    index < currentStep ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Step {currentStep + 1} of {ONBOARDING_STEPS.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {ONBOARDING_STEPS[currentStep].label}
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS.length}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </nav>
  );
}

export function StepProfile({
  data,
  errors,
  bookingLinkPrefix,
  onChange,
}: {
  data: ProfileData;
  errors: ProfileValidationErrors;
  bookingLinkPrefix: string;
  onChange: (data: ProfileData) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Create your public profile
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This information will be visible on your booking page.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={data.displayName}
            onChange={(e) => onChange({ ...data, displayName: e.target.value })}
            placeholder="Sarah Chen"
            aria-invalid={!!errors.displayName}
            aria-describedby={
              errors.displayName ? "displayName-error" : undefined
            }
          />
          {errors.displayName && (
            <p id="displayName-error" className="text-sm text-destructive">
              {errors.displayName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {bookingLinkPrefix}
            </span>
            <Input
              id="username"
              value={data.username}
              onChange={(e) => onChange({ ...data, username: e.target.value })}
              placeholder="sarah-chen"
              className="flex-1"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "username-error" : undefined}
            />
          </div>
          {errors.username && (
            <p id="username-error" className="text-sm text-destructive">
              {errors.username}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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

    if (isLocationType(value)) {
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
            onChange={(e) => onChange({ ...data, title: e.target.value })}
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
            value={getLocationSelectValue(data)}
            onChange={handleLocationSelectChange}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-invalid={!!errors.locationType || !!errors.videoProvider}
            aria-describedby={
              errors.locationType || errors.videoProvider
                ? "eventLocationType-error"
                : undefined
            }
          >
            <option value="custom">Custom link</option>
            <option value="phone">Phone</option>
            <option value="in_person">In Person</option>
            {videoProviderOptions.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
            <option value="online">Online (manual)</option>
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
              onChange={(e) =>
                onChange({ ...data, locationValue: e.target.value })
              }
              placeholder={getLocationPlaceholder(data.locationType)}
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

export function StepBookingLink({
  bookingLink,
  displayLink,
  copied,
  copyError,
  onCopy,
}: {
  bookingLink: string;
  displayLink: string;
  copied: boolean;
  copyError: string;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Share your booking link
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re all set! Share this link so people can book time with you.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Link2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-lg font-medium text-foreground break-all">
            {displayLink}
          </span>
        </div>

        <Button
          onClick={onCopy}
          variant={copied ? "secondary" : "default"}
          className="mt-4"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copy link
            </>
          )}
        </Button>
        {copyError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {copyError}
          </p>
        ) : null}
      </div>

      <div className="flex justify-center">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" size="lg">
            <Link href={bookingLink}>View booking page</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
