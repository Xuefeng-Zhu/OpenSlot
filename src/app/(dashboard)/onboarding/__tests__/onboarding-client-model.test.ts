import { afterEach, describe, expect, it, vi } from "vitest";
import {
  absoluteBookingLink,
  bookingLinkPrefix,
  getDefaultAvailability,
  hasValidationErrors,
  validateAvailability,
  validateEventType,
  validateProfile,
} from "../onboarding-client-model";

describe("onboarding client model", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds independent default weekday intervals", () => {
    const availability = getDefaultAvailability();

    availability.monday.intervals[0].start = "10:00";

    expect(availability.tuesday.intervals[0]).toEqual({
      start: "09:00",
      end: "17:00",
    });
    expect(availability.saturday).toEqual({ enabled: false, intervals: [] });
  });

  it("normalizes configured booking link origins", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.openslot.test/");

    expect(bookingLinkPrefix()).toBe("https://preview.openslot.test/");
    expect(absoluteBookingLink("/sarah/intro-call")).toBe(
      "https://preview.openslot.test/sarah/intro-call"
    );
  });

  it("validates profile fields before advancing", () => {
    expect(
      validateProfile({ displayName: " Sarah Chen ", username: "Sarah Chen" })
    ).toEqual({
      username: "Use lowercase letters, numbers, and hyphens.",
    });
  });

  it("validates availability requires at least one usable interval", () => {
    const availability = getDefaultAvailability();
    availability.monday.intervals = [{ start: "11:00", end: "10:00" }];
    availability.tuesday.enabled = false;
    availability.wednesday.enabled = false;
    availability.thursday.enabled = false;
    availability.friday.enabled = false;

    expect(validateAvailability(availability)).toEqual({
      days: {
        monday: "Complete each interval with an end time after the start time.",
      },
      general: "Set at least one available time before continuing.",
    });
  });

  it("validates event type location details by location kind", () => {
    expect(
      validateEventType({
        title: "Intro Call",
        duration: "30",
        locationType: "video_provider",
        locationValue: "",
        videoProvider: null,
      })
    ).toEqual({ videoProvider: "Choose a video provider." });

    expect(
      validateEventType({
        title: "Intro Call",
        duration: "30",
        locationType: "custom",
        locationValue: "",
        videoProvider: null,
      })
    ).toEqual({ locationValue: "Enter location details." });
  });

  it("detects nested validation errors", () => {
    expect(hasValidationErrors({ profile: {}, availability: { days: {} } })).toBe(
      false
    );
    expect(
      hasValidationErrors({
        profile: {},
        availability: { days: { monday: "Complete Monday." } },
      })
    ).toBe(true);
  });
});
