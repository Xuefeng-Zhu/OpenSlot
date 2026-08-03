import { describe, expect, it } from "vitest";
import {
  buildEventTypePayload,
  createEventTypeEditorState,
  hasEventTypeEditorChanges,
} from "../event-type-editor-model";

describe("event type editor model", () => {
  it("normalizes trimmed values and manual locations for API payloads", () => {
    const values = createEventTypeEditorState({
      id: "event-type-1",
      schedule_id: "33333333-3333-4333-8333-333333333333",
      title: "  Discovery Call  ",
      slug: "  discovery-call  ",
      description: "  Talk through the project  ",
      duration_minutes: 30,
      buffer_before_minutes: 5,
      buffer_after_minutes: 10,
      min_notice_minutes: 60,
      max_booking_days_ahead: 45,
      location_type: "custom",
      location_value: "  https://example.com/meeting  ",
      video_provider: "google_meet",
      invitee_questions: [],
      is_active: true,
      reminder_enabled: true,
      reminder_minutes_before: 60,
      reminder_guest_enabled: true,
      reminder_host_enabled: false,
    });

    expect(buildEventTypePayload(values)).toMatchObject({
      schedule_id: "33333333-3333-4333-8333-333333333333",
      title: "Discovery Call",
      slug: "discovery-call",
      description: "Talk through the project",
      location_value: "https://example.com/meeting",
      video_provider: null,
    });
  });

  it("keeps generated video provider settings when selected", () => {
    const values = createEventTypeEditorState({
      id: "event-type-2",
      schedule_id: "33333333-3333-4333-8333-333333333333",
      title: "Roadmap Review",
      slug: "roadmap-review",
      description: "",
      duration_minutes: 45,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_minutes: 120,
      max_booking_days_ahead: 30,
      location_type: "video_provider",
      location_value: "",
      video_provider: "microsoft_teams",
      invitee_questions: [],
      is_active: false,
      reminder_enabled: false,
      reminder_minutes_before: 1440,
      reminder_guest_enabled: true,
      reminder_host_enabled: true,
    });

    expect(buildEventTypePayload(values)).toMatchObject({
      location_type: "video_provider",
      location_value: "",
      video_provider: "microsoft_teams",
      is_active: false,
    });
  });

  it("compares nested invitee questions semantically", () => {
    const saved = createEventTypeEditorState({
      id: "event-type-3",
      schedule_id: "33333333-3333-4333-8333-333333333333",
      title: "Research call",
      slug: "research-call",
      description: "",
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_minutes: 60,
      max_booking_days_ahead: 30,
      location_type: "online",
      location_value: "https://example.com/research",
      invitee_questions: [
        {
          id: "topic",
          label: "Choose a topic",
          type: "select",
          required: true,
          options: ["Product", "Research"],
        },
      ],
      is_active: true,
      reminder_enabled: false,
      reminder_minutes_before: 1440,
      reminder_guest_enabled: true,
      reminder_host_enabled: true,
    });
    const whitespaceOnly = {
      ...saved,
      title: "  Research call  ",
      invitee_questions: [
        {
          ...saved.invitee_questions[0],
          label: "  Choose a topic  ",
          options: [" Product ", "Research"],
        },
      ],
    };
    const changedOption = {
      ...whitespaceOnly,
      invitee_questions: [
        {
          ...whitespaceOnly.invitee_questions[0],
          options: ["Product", "Engineering"],
        },
      ],
    };

    expect(hasEventTypeEditorChanges(whitespaceOnly, saved)).toBe(false);
    expect(hasEventTypeEditorChanges(changedOption, saved)).toBe(true);
  });
});
