import { describe, expect, it } from "vitest";

import {
  formatBookingLocationLabel,
  formatEventLocationLabel,
} from "@/lib/location-labels";

describe("location label formatting", () => {
  it("formats event location labels for public and dashboard contexts", () => {
    expect(formatEventLocationLabel({ location_type: "phone" })).toBe("Phone");
    expect(
      formatEventLocationLabel(
        { location_type: "phone" },
        { style: "dashboard" }
      )
    ).toBe("Phone call");
    expect(
      formatEventLocationLabel({
        location_type: "video_provider",
        video_provider: "google_meet",
      })
    ).toBe("Google Meet");
  });

  it("formats booking location labels with provider and value precedence", () => {
    expect(
      formatBookingLocationLabel({
        locationType: "video_provider",
        locationValue: "Manual room",
        conferenceProvider: "microsoft_teams",
      })
    ).toBe("Microsoft Teams");
    expect(
      formatBookingLocationLabel({
        locationType: "custom",
        locationValue: "Manual room",
      })
    ).toBe("Manual room");
    expect(formatBookingLocationLabel({ locationType: "in_person" })).toBe(
      "In person"
    );
    expect(formatBookingLocationLabel({ locationType: "custom" })).toBeNull();
  });
});
