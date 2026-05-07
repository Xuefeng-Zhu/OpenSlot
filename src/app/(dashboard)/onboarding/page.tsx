"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, User, Calendar, FileText, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AvailabilityDayRow,
  type TimeInterval,
} from "@/components/dashboard/availability-day-row";

const STEPS = [
  { label: "Create public profile", icon: User },
  { label: "Set availability", icon: Calendar },
  { label: "Create first event type", icon: FileText },
  { label: "Share booking link", icon: Link2 },
] as const;

interface ProfileData {
  displayName: string;
  username: string;
  bio: string;
  avatarFile: File | null;
}

interface DayAvailability {
  enabled: boolean;
  intervals: TimeInterval[];
}

interface AvailabilityData {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

interface EventTypeData {
  title: string;
  duration: string;
  location: string;
}

interface ProfileValidationErrors {
  displayName?: string;
  username?: string;
}

interface AvailabilityValidationErrors {
  general?: string;
  days: Partial<Record<keyof AvailabilityData, string>>;
}

interface EventTypeValidationErrors {
  title?: string;
  location?: string;
}

interface OnboardingValidationErrors {
  profile: ProfileValidationErrors;
  availability: AvailabilityValidationErrors;
  eventType: EventTypeValidationErrors;
}

const DEFAULT_WEEKDAY: DayAvailability = {
  enabled: true,
  intervals: [{ start: "09:00", end: "17:00" }],
};

const DEFAULT_WEEKEND: DayAvailability = {
  enabled: false,
  intervals: [],
};

function getDefaultAvailability(): AvailabilityData {
  return {
    monday: { ...DEFAULT_WEEKDAY, intervals: [...DEFAULT_WEEKDAY.intervals] },
    tuesday: { ...DEFAULT_WEEKDAY, intervals: [...DEFAULT_WEEKDAY.intervals] },
    wednesday: { ...DEFAULT_WEEKDAY, intervals: [...DEFAULT_WEEKDAY.intervals] },
    thursday: { ...DEFAULT_WEEKDAY, intervals: [...DEFAULT_WEEKDAY.intervals] },
    friday: { ...DEFAULT_WEEKDAY, intervals: [...DEFAULT_WEEKDAY.intervals] },
    saturday: { ...DEFAULT_WEEKEND, intervals: [...DEFAULT_WEEKEND.intervals] },
    sunday: { ...DEFAULT_WEEKEND, intervals: [...DEFAULT_WEEKEND.intervals] },
  };
}

function getEmptyValidationErrors(): OnboardingValidationErrors {
  return {
    profile: {},
    availability: { days: {} },
    eventType: {},
  };
}

function validateProfile(data: ProfileData): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};

  if (!data.displayName.trim()) {
    errors.displayName = "Enter the display name people will see.";
  }

  if (!data.username.trim()) {
    errors.username = "Choose a username for your booking link.";
  } else if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(data.username.trim())) {
    errors.username = "Use lowercase letters, numbers, and hyphens.";
  }

  return errors;
}

function validateAvailability(data: AvailabilityData): AvailabilityValidationErrors {
  const errors: AvailabilityValidationErrors = { days: {} };
  let hasBookableInterval = false;

  for (const [day, availability] of Object.entries(data) as [
    keyof AvailabilityData,
    DayAvailability,
  ][]) {
    if (!availability.enabled) {
      continue;
    }

    if (availability.intervals.length === 0) {
      errors.days[day] =
        "Add at least one time interval or turn this day off.";
      continue;
    }

    const invalidInterval = availability.intervals.find((interval) => {
      if (!interval.start || !interval.end) {
        return true;
      }
      return interval.end <= interval.start;
    });

    if (invalidInterval) {
      errors.days[day] =
        "Complete each interval with an end time after the start time.";
      continue;
    }

    hasBookableInterval = true;
  }

  if (!hasBookableInterval) {
    errors.general = "Set at least one available time before continuing.";
  }

  return errors;
}

function validateEventType(data: EventTypeData): EventTypeValidationErrors {
  const errors: EventTypeValidationErrors = {};

  if (!data.title.trim()) {
    errors.title = "Enter a title for this event type.";
  }

  if (!data.location.trim()) {
    errors.location = "Enter where this meeting will happen.";
  }

  return errors;
}

function hasValidationErrors(errors: unknown): boolean {
  if (!errors || typeof errors !== "object") {
    return false;
  }

  return Object.values(errors).some((value) => {
    if (!value) {
      return false;
    }
    if (typeof value === "string") {
      return true;
    }
    return hasValidationErrors(value);
  });
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [validationErrors, setValidationErrors] =
    React.useState<OnboardingValidationErrors>(getEmptyValidationErrors);

  // Step 1: Profile data
  const [profileData, setProfileData] = React.useState<ProfileData>({
    displayName: "",
    username: "",
    bio: "",
    avatarFile: null,
  });

  // Step 2: Availability data
  const [availabilityData, setAvailabilityData] = React.useState<AvailabilityData>(
    getDefaultAvailability()
  );

  // Step 3: Event type data
  const [eventTypeData, setEventTypeData] = React.useState<EventTypeData>({
    title: "",
    duration: "30",
    location: "",
  });

  const handleProfileChange = (data: ProfileData) => {
    setProfileData(data);
    setValidationErrors((prev) => ({ ...prev, profile: {} }));
  };

  const handleEventTypeChange = (data: EventTypeData) => {
    setEventTypeData(data);
    setValidationErrors((prev) => ({ ...prev, eventType: {} }));
  };

  const handleNext = () => {
    if (currentStep === 0) {
      const profileErrors = validateProfile(profileData);
      if (hasValidationErrors(profileErrors)) {
        setValidationErrors((prev) => ({ ...prev, profile: profileErrors }));
        return;
      }
    }

    if (currentStep === 1) {
      const availabilityErrors = validateAvailability(availabilityData);
      if (hasValidationErrors(availabilityErrors)) {
        setValidationErrors((prev) => ({
          ...prev,
          availability: availabilityErrors,
        }));
        return;
      }
    }

    if (currentStep === 2) {
      const eventTypeErrors = validateEventType(eventTypeData);
      if (hasValidationErrors(eventTypeErrors)) {
        setValidationErrors((prev) => ({
          ...prev,
          eventType: eventTypeErrors,
        }));
        return;
      }
    }

    if (currentStep < STEPS.length - 1) {
      setValidationErrors(getEmptyValidationErrors());
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCopyLink = async () => {
    const slug = eventTypeData.title
      ? eventTypeData.title.toLowerCase().replace(/\s+/g, "-")
      : "meeting";
    const link = `openslot.com/${profileData.username || "username"}/${slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: just show copied state briefly
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const updateAvailabilityDay = (
    day: keyof AvailabilityData,
    updates: Partial<DayAvailability>
  ) => {
    setValidationErrors((prev) => ({
      ...prev,
      availability: { days: {} },
    }));
    setAvailabilityData((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      {/* Progress Indicator */}
      <ProgressIndicator currentStep={currentStep} />

      {/* Step Content */}
      <div className="mt-8">
        {currentStep === 0 && (
          <StepProfile
            data={profileData}
            errors={validationErrors.profile}
            onChange={handleProfileChange}
          />
        )}
        {currentStep === 1 && (
          <StepAvailability
            data={availabilityData}
            errors={validationErrors.availability}
            onDayChange={updateAvailabilityDay}
          />
        )}
        {currentStep === 2 && (
          <StepEventType
            data={eventTypeData}
            errors={validationErrors.eventType}
            onChange={handleEventTypeChange}
          />
        )}
        {currentStep === 3 && (
          <StepBookingLink
            username={profileData.username}
            eventTitle={eventTypeData.title}
            copied={copied}
            onCopy={handleCopyLink}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 flex items-center justify-between">
        {currentStep > 0 && currentStep < STEPS.length - 1 ? (
          <Button variant="secondary" onClick={handleBack}>
            Back
          </Button>
        ) : (
          <div />
        )}
        {currentStep < STEPS.length - 1 && (
          <Button onClick={handleNext}>
            {currentStep === STEPS.length - 2 ? "Finish" : "Next"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Progress Indicator ─── */

function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Onboarding progress">
      {/* Desktop: full labels */}
      <ol className="hidden md:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const Icon = step.icon;
          return (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isActive && "border-primary bg-accent text-primary",
                    !isCompleted && !isActive && "border-border bg-background text-muted-foreground"
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
                    isActive ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
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

      {/* Mobile: compact progress bar */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {STEPS[currentStep].label}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}

/* ─── Step 1: Profile ─── */

function StepProfile({
  data,
  errors,
  onChange,
}: {
  data: ProfileData;
  errors: ProfileValidationErrors;
  onChange: (data: ProfileData) => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Create your public profile</h2>
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
            <span className="text-sm text-muted-foreground">openslot.com/</span>
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

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={data.bio}
            onChange={(e) => onChange({ ...data, bio: e.target.value })}
            placeholder="Tell people a bit about yourself..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar">Avatar (optional)</Label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground text-lg font-medium">
              {data.displayName
                ? data.displayName.charAt(0).toUpperCase()
                : "?"}
            </div>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload photo
              </Button>
              <input
                ref={fileInputRef}
                id="avatar"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onChange({ ...data, avatarFile: file });
                }}
              />
              {data.avatarFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.avatarFile.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2: Availability ─── */

function StepAvailability({
  data,
  errors,
  onDayChange,
}: {
  data: AvailabilityData;
  errors: AvailabilityValidationErrors;
  onDayChange: (day: keyof AvailabilityData, updates: Partial<DayAvailability>) => void;
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
        <h2 className="text-xl font-semibold text-foreground">Set your availability</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define when you&apos;re available for bookings. You can change this later.
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

/* ─── Step 3: Event Type ─── */

function StepEventType({
  data,
  errors,
  onChange,
}: {
  data: EventTypeData;
  errors: EventTypeValidationErrors;
  onChange: (data: EventTypeData) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Create your first event type</h2>
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
          <Label htmlFor="eventLocation">Location</Label>
          <Input
            id="eventLocation"
            value={data.location}
            onChange={(e) => onChange({ ...data, location: e.target.value })}
            placeholder="Online meeting, phone call, or in person"
            aria-invalid={!!errors.location}
            aria-describedby={
              errors.location ? "eventLocation-error" : undefined
            }
          />
          {errors.location && (
            <p id="eventLocation-error" className="text-sm text-destructive">
              {errors.location}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 4: Booking Link ─── */

function StepBookingLink({
  username,
  eventTitle,
  copied,
  onCopy,
}: {
  username: string;
  eventTitle: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const slug = eventTitle
    ? eventTitle.toLowerCase().replace(/\s+/g, "-")
    : "meeting";
  const bookingLink = `openslot.com/${username || "username"}/${slug}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Share your booking link</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re all set! Share this link so people can book time with you.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Link2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-lg font-medium text-foreground break-all">
            {bookingLink}
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
      </div>

      <div className="flex justify-center">
        <Button asChild size="lg">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
