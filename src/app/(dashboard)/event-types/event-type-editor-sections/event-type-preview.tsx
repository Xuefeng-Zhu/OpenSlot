import {
  SlotPicker,
  type SlotPickerEventType,
  type SlotPickerHostProfile,
} from "@/components/booking/slot-picker";
import { PublicSchedulePreviewShell } from "@/components/booking/public-schedule-preview-shell";
import { type EventTypeEditorFormState } from "../event-type-editor-model";

interface EventTypePreviewProps {
  mode: "create" | "edit";
  eventTypeId?: string;
  hostProfile: SlotPickerHostProfile;
  values: EventTypeEditorFormState;
}

export function EventTypePreview({
  mode,
  eventTypeId,
  hostProfile,
  values,
}: EventTypePreviewProps) {
  const previewEventType = toPreviewEventType(
    values,
    hostProfile.id,
    eventTypeId
  );
  const shouldRenderLiveFlow = mode === "edit" && eventTypeId && values.is_active;

  return (
    <div className="sticky top-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Live preview
        </h2>
      </div>
      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border border-border bg-background p-4">
        {shouldRenderLiveFlow ? (
          <SlotPicker
            eventType={previewEventType}
            hostProfile={hostProfile}
            layout="embedded"
          />
        ) : (
          <PublicSchedulePreviewShell
            eventType={previewEventType}
            hostProfile={hostProfile}
            layout="embedded"
            unavailableDescription={
              mode === "create"
                ? "Save this event type to load bookable times."
                : "Make this event type visible to load bookable times."
            }
          />
        )}
      </div>
    </div>
  );
}

function toPreviewEventType(
  values: EventTypeEditorFormState,
  hostUserId: string,
  eventTypeId?: string
): SlotPickerEventType {
  const locationType = values.location_type;

  return {
    id: eventTypeId ?? "preview-event-type",
    title: values.title.trim() || "Event Title",
    slug: values.slug.trim() || "event-title",
    description: values.description.trim(),
    duration_minutes: values.duration_minutes,
    location_type: locationType,
    location_value: values.location_value.trim() || null,
    video_provider:
      locationType === "video_provider" ? values.video_provider : null,
    invitee_questions: values.invitee_questions,
    user_id: hostUserId,
  };
}
