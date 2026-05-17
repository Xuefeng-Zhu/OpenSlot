import { videoProviderLabel } from "@/lib/calendar/video-providers";

export interface EventLocationLabelInput {
  location_type: string;
  video_provider?: string | null;
}

export function formatEventLocationLabel(
  eventType: EventLocationLabelInput
): string {
  const generatedVideoLabel = videoProviderLabel(eventType.video_provider);
  if (generatedVideoLabel) return generatedVideoLabel;

  switch (eventType.location_type) {
    case "online":
      return "Online";
    case "phone":
      return "Phone";
    case "in_person":
      return "In Person";
    case "custom":
      return "Custom";
    case "video_provider":
      return "Video";
    default:
      return eventType.location_type;
  }
}
