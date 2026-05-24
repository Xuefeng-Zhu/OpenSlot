"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCopyFeedback } from "@/components/shared/use-copy-feedback";
import { copyTextToClipboard } from "@/lib/utils/clipboard";
import { browserTimezoneOrDefault } from "@/lib/utils/timezone";
import {
  ONBOARDING_STEPS,
  ProgressIndicator,
  StepAvailability,
  StepBookingLink,
  StepEventType,
  StepProfile,
  type AvailabilityData,
  type AvailabilityValidationErrors,
  type DayAvailability,
  type EventTypeData,
  type EventTypeValidationErrors,
  type ProfileData,
  type ProfileValidationErrors,
} from "./onboarding-steps";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

function bookingLinkPrefix() {
  const appUrl = getAppUrl();
  return appUrl ? `${appUrl}/` : "/";
}

function absoluteBookingLink(path: string) {
  const appUrl = getAppUrl();
  return appUrl ? `${appUrl}${path}` : path;
}

interface OnboardingValidationErrors {
  profile: ProfileValidationErrors;
  availability: AvailabilityValidationErrors;
  eventType: EventTypeValidationErrors;
}

interface OnboardingSaveResponse {
  success: boolean;
  bookingLink?: string;
  error?: string;
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
  } else if (data.username.trim().length < 3) {
    errors.username = "Use at least 3 characters.";
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

  if (data.locationType === "video_provider") {
    if (!data.videoProvider) {
      errors.videoProvider = "Choose a video provider.";
    }
  } else if (!data.locationValue.trim()) {
    errors.locationValue = "Enter location details.";
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

/**
 * Multi-step onboarding flow that collects the first profile, availability, and
 * event type in one client-side wizard before submitting a single setup payload.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const { copied, resetCopied, showCopied } = useCopyFeedback();
  const [copyError, setCopyError] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [savedBookingLink, setSavedBookingLink] = React.useState("");
  const [validationErrors, setValidationErrors] =
    React.useState<OnboardingValidationErrors>(getEmptyValidationErrors);

  // Step 1: Profile data
  const [profileData, setProfileData] = React.useState<ProfileData>({
    displayName: "",
    username: "",
  });

  // Step 2: Availability data
  const [availabilityData, setAvailabilityData] = React.useState<AvailabilityData>(
    getDefaultAvailability()
  );

  // Step 3: Event type data
  const [eventTypeData, setEventTypeData] = React.useState<EventTypeData>({
    title: "",
    duration: "30",
    locationType: "online",
    locationValue: "",
    videoProvider: null,
  });

  const handleProfileChange = (data: ProfileData) => {
    setProfileData(data);
    setValidationErrors((prev) => ({ ...prev, profile: {} }));
  };

  const handleEventTypeChange = (data: EventTypeData) => {
    setEventTypeData(data);
    setValidationErrors((prev) => ({ ...prev, eventType: {} }));
  };

  const saveOnboarding = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: profileData,
          availability: availabilityData,
          eventType: eventTypeData,
          timezone: browserTimezoneOrDefault(),
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as OnboardingSaveResponse | null;

      if (!response.ok || !data?.success || !data.bookingLink) {
        setSaveError(
          data?.error || "Failed to save onboarding. Please try again."
        );
        return;
      }

      setSavedBookingLink(data.bookingLink);
      setCopyError("");
      setValidationErrors(getEmptyValidationErrors());
      setCurrentStep(ONBOARDING_STEPS.length - 1);
      router.refresh();
    } catch {
      setSaveError("Unable to save onboarding. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    setSaveError("");

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

      await saveOnboarding();
      return;
    }

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setValidationErrors(getEmptyValidationErrors());
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && !isSaving) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCopyLink = async () => {
    const link = absoluteBookingLink(savedBookingLink);
    try {
      await copyTextToClipboard(link);
      showCopied();
      setCopyError("");
    } catch {
      resetCopied();
      setCopyError("Could not copy link. Select the URL and copy it manually.");
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
            bookingLinkPrefix={bookingLinkPrefix()}
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
        {saveError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {saveError}
          </div>
        )}
        {currentStep === 3 && (
          <StepBookingLink
            bookingLink={savedBookingLink}
            displayLink={absoluteBookingLink(savedBookingLink)}
            copied={copied}
            copyError={copyError}
            onCopy={handleCopyLink}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 flex items-center justify-between">
        {currentStep > 0 && currentStep < ONBOARDING_STEPS.length - 1 ? (
          <Button variant="secondary" onClick={handleBack} disabled={isSaving}>
            Back
          </Button>
        ) : (
          <div />
        )}
        {currentStep < ONBOARDING_STEPS.length - 1 && (
          <Button onClick={handleNext} disabled={isSaving}>
            {currentStep === ONBOARDING_STEPS.length - 2
              ? isSaving ? "Saving..." : "Finish"
              : "Next"}
          </Button>
        )}
      </div>
    </div>
  );
}
