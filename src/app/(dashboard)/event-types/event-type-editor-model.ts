import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import type {
  EventLocationType,
  EventTypeFormValues,
  VideoProvider,
} from "@/lib/validations/event-type";
import type { InviteeQuestion } from "@/lib/validations/invitee-questions";

export interface EditableEventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_booking_days_ahead: number;
  location_type: EventTypeFormValues["location_type"];
  location_value: string;
  video_provider?: EventTypeFormValues["video_provider"];
  invitee_questions: InviteeQuestion[];
  is_active: boolean;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  reminder_guest_enabled: boolean;
  reminder_host_enabled: boolean;
}

export type EventTypeEditorFormState = Omit<
  EditableEventType,
  "id" | "video_provider"
> & {
  video_provider: EventTypeFormValues["video_provider"];
};

export type UpdateEventTypeEditorField = <
  Field extends keyof EventTypeEditorFormState,
>(
  field: Field,
  value: EventTypeEditorFormState[Field]
) => void;

export type FieldErrors = Partial<Record<keyof EventTypeFormValues, string>>;

export type ApiResponse = {
  error?: string;
  details?: Partial<Record<keyof EventTypeFormValues, string[]>>;
};

export type VideoProviderHealth = { ready: boolean; message: string };

export const defaultEventType: EventTypeEditorFormState = {
  title: "",
  slug: "",
  description: "",
  duration_minutes: 30,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 60,
  max_booking_days_ahead: 60,
  location_type: "online",
  location_value: "",
  video_provider: null,
  invitee_questions: [],
  is_active: true,
  reminder_enabled: false,
  reminder_minutes_before: 1440,
  reminder_guest_enabled: true,
  reminder_host_enabled: true,
};

export function createEventTypeEditorState(
  initialEventType?: EditableEventType
): EventTypeEditorFormState {
  const source = initialEventType ?? defaultEventType;

  return {
    ...defaultEventType,
    ...source,
    video_provider: source.video_provider ?? null,
    invitee_questions: source.invitee_questions.map((question) => ({
      ...question,
      options: [...question.options],
    })),
  };
}

export function buildEventTypePayload(
  values: EventTypeEditorFormState
): EventTypeFormValues {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    description: values.description.trim(),
    duration_minutes: values.duration_minutes,
    buffer_before_minutes: values.buffer_before_minutes,
    buffer_after_minutes: values.buffer_after_minutes,
    min_notice_minutes: values.min_notice_minutes,
    max_booking_days_ahead: values.max_booking_days_ahead,
    location_type: values.location_type,
    location_value: values.location_value.trim(),
    video_provider:
      values.location_type === "video_provider"
        ? values.video_provider ?? null
        : null,
    invitee_questions: values.invitee_questions,
    is_active: values.is_active,
    reminder_enabled: values.reminder_enabled,
    reminder_minutes_before: values.reminder_minutes_before,
    reminder_guest_enabled: values.reminder_guest_enabled,
    reminder_host_enabled: values.reminder_host_enabled,
  };
}

export function firstFieldErrors(
  details: Partial<Record<keyof EventTypeFormValues, string[]>> | undefined
) {
  const nextErrors: FieldErrors = {};

  if (!details) return nextErrors;

  for (const [field, messages] of Object.entries(details) as Array<
    [keyof EventTypeFormValues, string[] | undefined]
  >) {
    if (messages?.[0]) {
      nextErrors[field] = messages[0];
    }
  }

  return nextErrors;
}

export function isVideoProviderValue(value: string): value is VideoProvider {
  return value === "google_meet" || value === "microsoft_teams";
}

export function locationPlaceholder(
  locationType: EventTypeFormValues["location_type"]
) {
  if (locationType === "phone") return "e.g. +1 555 123 4567";
  if (locationType === "in_person") return "e.g. 123 Market Street";
  if (locationType === "custom") return "e.g. https://example.com/meeting";
  return "e.g. Online meeting details";
}

export function locationPreviewType(
  locationType: EventTypeFormValues["location_type"],
  videoProvider: EventTypeFormValues["video_provider"]
) {
  if (locationType === "video_provider") {
    return videoProvider === "microsoft_teams"
      ? "Microsoft Teams"
      : "Google Meet";
  }

  if (locationType === "in_person") return "In person";
  if (locationType === "custom") return "Custom link";
  if (locationType === "phone") return "Phone";
  return "Online (manual)";
}

export function locationPreviewDetails(
  locationType: EventTypeFormValues["location_type"],
  locationValue: string,
  videoStatusMessage?: string
) {
  if (locationType === "video_provider") {
    return videoStatusMessage ?? "Generated automatically for new bookings";
  }

  return locationValue.trim() || "Not set";
}

export function videoProviderHealth(
  provider: VideoProvider,
  connections: CalendarConnectionSummary[]
): VideoProviderHealth {
  const calendarProvider = provider === "google_meet" ? "google" : "microsoft";
  const label = provider === "google_meet" ? "Google Meet" : "Microsoft Teams";
  const connection = connections.find(
    (item) => item.provider === calendarProvider
  );

  if (!connection) {
    return {
      ready: false,
      message: `${label} needs a connected calendar account before links can be generated.`,
    };
  }

  if (connection.status !== "active") {
    return {
      ready: false,
      message: `${label} calendar connection needs attention before links can be generated.`,
    };
  }

  if (!connection.calendars.some((calendar) => calendar.useForWrites)) {
    return {
      ready: false,
      message: `${label} needs a writable calendar selected for booking writes.`,
    };
  }

  return {
    ready: true,
    message: `${label} is ready to generate links for new bookings.`,
  };
}

export function createQuestionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replaceAll("-", "");
  }

  return `q_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
