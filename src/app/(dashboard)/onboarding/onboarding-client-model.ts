import type {
  AvailabilityData,
  AvailabilityValidationErrors,
  DayAvailability,
  EventTypeData,
  EventTypeValidationErrors,
  ProfileData,
  ProfileValidationErrors,
} from "./onboarding-steps";

export interface OnboardingValidationErrors {
  profile: ProfileValidationErrors;
  availability: AvailabilityValidationErrors;
  eventType: EventTypeValidationErrors;
}

export interface OnboardingSaveResponse {
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

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

export function bookingLinkPrefix() {
  const appUrl = getAppUrl();
  return appUrl ? `${appUrl}/` : "/";
}

export function absoluteBookingLink(path: string) {
  const appUrl = getAppUrl();
  return appUrl ? `${appUrl}${path}` : path;
}

export function getDefaultAvailability(): AvailabilityData {
  return {
    monday: cloneDayAvailability(DEFAULT_WEEKDAY),
    tuesday: cloneDayAvailability(DEFAULT_WEEKDAY),
    wednesday: cloneDayAvailability(DEFAULT_WEEKDAY),
    thursday: cloneDayAvailability(DEFAULT_WEEKDAY),
    friday: cloneDayAvailability(DEFAULT_WEEKDAY),
    saturday: cloneDayAvailability(DEFAULT_WEEKEND),
    sunday: cloneDayAvailability(DEFAULT_WEEKEND),
  };
}

function cloneDayAvailability(day: DayAvailability): DayAvailability {
  return {
    ...day,
    intervals: day.intervals.map((interval) => ({ ...interval })),
  };
}

export function getEmptyValidationErrors(): OnboardingValidationErrors {
  return {
    profile: {},
    availability: { days: {} },
    eventType: {},
  };
}

export function validateProfile(data: ProfileData): ProfileValidationErrors {
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

export function validateAvailability(data: AvailabilityData): AvailabilityValidationErrors {
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

export function validateEventType(data: EventTypeData): EventTypeValidationErrors {
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

export function hasValidationErrors(errors: unknown): boolean {
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
