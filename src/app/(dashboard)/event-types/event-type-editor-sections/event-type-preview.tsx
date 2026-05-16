import { BookingSummaryCard } from "@/components/booking/booking-summary-card";
import {
  type EventTypeEditorFormState,
  locationPreviewDetails,
  locationPreviewType,
  type VideoProviderHealth,
} from "../event-type-editor-model";

interface EventTypePreviewProps {
  hostName: string;
  values: EventTypeEditorFormState;
  selectedVideoHealth: VideoProviderHealth | null;
}

export function EventTypePreview({
  hostName,
  values,
  selectedVideoHealth,
}: EventTypePreviewProps) {
  return (
    <div className="sticky top-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Live preview
        </h2>
      </div>
      <BookingSummaryCard
        hostName={hostName}
        eventTitle={values.title || "Event Title"}
        description={values.description}
        urlSlug={values.slug}
        visibility={
          values.is_active ? "Visible to guests" : "Hidden from guests"
        }
        duration={values.duration_minutes}
        bufferBefore={values.buffer_before_minutes}
        bufferAfter={values.buffer_after_minutes}
        minNotice={values.min_notice_minutes}
        maxDaysAhead={values.max_booking_days_ahead}
        timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
        showTimezone={false}
        locationType={locationPreviewType(
          values.location_type,
          values.video_provider
        )}
        locationDetails={locationPreviewDetails(
          values.location_type,
          values.location_value,
          selectedVideoHealth?.message
        )}
        questions={values.invitee_questions}
      />
    </div>
  );
}
