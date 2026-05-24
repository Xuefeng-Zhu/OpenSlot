import { videoProviderLabel } from "@/lib/calendar/video-providers";

export interface EventLocationLabelInput {
  location_type: string;
  video_provider?: string | null;
}

export interface BookingLocationLabelInput {
  locationType?: string | null;
  locationValue?: string | null;
  conferenceProvider?: string | null;
}

export type EventLocationLabelStyle = "short" | "dashboard";

const eventLocationLabels: Record<
  EventLocationLabelStyle,
  Record<string, string>
> = {
  short: {
    online: "Online",
    phone: "Phone",
    in_person: "In Person",
    custom: "Custom",
    video_provider: "Video",
  },
  dashboard: {
    online: "Online meeting",
    phone: "Phone call",
    in_person: "In person",
    custom: "Custom location",
    video_provider: "Video meeting",
  },
};

export function formatEventLocationLabel(
  eventType: EventLocationLabelInput,
  options: { style?: EventLocationLabelStyle } = {}
): string {
  const generatedVideoLabel = videoProviderLabel(eventType.video_provider);
  if (generatedVideoLabel) return generatedVideoLabel;

  const labels = eventLocationLabels[options.style ?? "short"];
  return labels[eventType.location_type] ?? eventType.location_type;
}

export function formatBookingLocationLabel({
  locationType,
  locationValue,
  conferenceProvider,
}: BookingLocationLabelInput): string | null {
  const generatedVideoLabel = videoProviderLabel(conferenceProvider);
  if (generatedVideoLabel) return generatedVideoLabel;
  if (locationValue) return locationValue;
  if (locationType === "phone") return "Phone call";
  if (locationType === "in_person") return "In person";
  if (locationType === "online") return "Online";
  return null;
}
