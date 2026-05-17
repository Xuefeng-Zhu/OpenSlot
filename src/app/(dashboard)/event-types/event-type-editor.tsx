"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import { eventTypeSchema } from "@/lib/validations/event-type";
import { BasicsSection } from "./event-type-editor-sections/basics-section";
import { ConfirmationSection } from "./event-type-editor-sections/confirmation-section";
import { DurationBuffersSection } from "./event-type-editor-sections/duration-buffers-section";
import { EventTypePreview } from "./event-type-editor-sections/event-type-preview";
import { EventTypeSectionCard } from "./event-type-editor-sections/event-type-section-card";
import {
  FORM_SECTIONS,
  type FormSectionId,
} from "./event-type-editor-sections/form-sections";
import { InviteeQuestionsSection } from "./event-type-editor-sections/invitee-questions-section";
import { LocationSection } from "./event-type-editor-sections/location-section";
import { RemindersSection } from "./event-type-editor-sections/reminders-section";
import { SchedulingLimitsSection } from "./event-type-editor-sections/scheduling-limits-section";
import {
  type ApiResponse,
  type EditableEventType,
  firstFieldErrors,
  videoProviderHealth,
} from "./event-type-editor-model";
import { useEventTypeEditorState } from "./use-event-type-editor-state";
import type { SlotPickerHostProfile } from "@/components/booking/slot-picker";

export type { EditableEventType } from "./event-type-editor-model";

interface EventTypeEditorProps {
  mode: "create" | "edit";
  hostProfile: SlotPickerHostProfile;
  initialEventType?: EditableEventType;
  calendarConnections?: CalendarConnectionSummary[];
  calendarConnectionsLoadFailed?: boolean;
}

const initialOpenSections: Record<FormSectionId, boolean> = {
  basics: true,
  duration: false,
  location: false,
  scheduling: false,
  reminders: false,
  questions: false,
  confirmation: false,
};

/**
 * Create/edit shell for event types. Form state, payload construction, and
 * section rendering live in focused modules so feature changes stay isolated.
 */
export function EventTypeEditor({
  mode,
  hostProfile,
  initialEventType,
  calendarConnections = [],
  calendarConnectionsLoadFailed = false,
}: EventTypeEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openSections, setOpenSections] =
    useState<Record<FormSectionId, boolean>>(initialOpenSections);
  const {
    values,
    errors,
    setErrors,
    clearFieldError,
    updateField,
    addQuestion,
    removeQuestion,
    updateQuestion,
    updateQuestionType,
    updateQuestionOptions,
    selectLocation,
    buildPayload,
  } = useEventTypeEditorState(initialEventType);
  const selectedVideoHealth = !calendarConnectionsLoadFailed && values.video_provider
    ? videoProviderHealth(values.video_provider, calendarConnections)
    : null;
  const editorFormId =
    mode === "edit" && initialEventType
      ? `event-type-editor-${initialEventType.id}`
      : "event-type-editor-new";

  const toggleSection = (id: FormSectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = eventTypeSchema.safeParse(buildPayload());

    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error.flatten().fieldErrors));
      setServerError("");
      return;
    }

    if (mode === "edit" && !initialEventType) {
      setServerError("Event type not found.");
      return;
    }

    setErrors({});
    setServerError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/event-types"
          : `/api/event-types/${initialEventType?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );
      const result = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!response.ok) {
        const fieldErrors = firstFieldErrors(result?.details);
        setErrors(fieldErrors);
        setServerError(
          Object.keys(fieldErrors).length > 0
            ? ""
            : result?.error ?? "Failed to save event type."
        );
        return;
      }

      toast({
        title: mode === "create" ? "Event type created" : "Event type updated",
        description: `"${parsed.data.title}" has been saved successfully.`,
      });
      router.push("/event-types");
      router.refresh();
    } catch {
      setServerError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/event-types");
  };

  const renderSection = (sectionId: FormSectionId) => {
    switch (sectionId) {
      case "basics":
        return (
          <BasicsSection
            values={values}
            errors={errors}
            onFieldChange={updateField}
            clearFieldError={clearFieldError}
          />
        );
      case "duration":
        return (
          <DurationBuffersSection
            values={values}
            errors={errors}
            onFieldChange={updateField}
            clearFieldError={clearFieldError}
          />
        );
      case "location":
        return (
          <LocationSection
            values={values}
            errors={errors}
            onFieldChange={updateField}
            clearFieldError={clearFieldError}
            selectedVideoHealth={selectedVideoHealth}
            onLocationSelectChange={selectLocation}
          />
        );
      case "scheduling":
        return (
          <SchedulingLimitsSection
            values={values}
            errors={errors}
            onFieldChange={updateField}
            clearFieldError={clearFieldError}
          />
        );
      case "reminders":
        return (
          <RemindersSection
            values={values}
            errors={errors}
            onFieldChange={updateField}
            clearFieldError={clearFieldError}
          />
        );
      case "questions":
        return (
          <InviteeQuestionsSection
            questions={values.invitee_questions}
            error={errors.invitee_questions}
            onAddQuestion={addQuestion}
            onRemoveQuestion={removeQuestion}
            onUpdateQuestion={updateQuestion}
            onUpdateQuestionType={updateQuestionType}
            onUpdateQuestionOptions={updateQuestionOptions}
          />
        );
      case "confirmation":
        return <ConfirmationSection />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? "Create event type" : "Edit event type"}
        description={
          mode === "create"
            ? "Set up a focused booking option guests can understand at a glance."
            : `Update the settings for "${
                values.title || initialEventType?.title
              }".`
        }
      />

      {calendarConnectionsLoadFailed ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          Calendar connection status could not be loaded. Event type settings
          remain editable, but video provider readiness may be incomplete.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <form
          id={editorFormId}
          onSubmit={handleSubmit}
          className="lg:col-span-3 space-y-4"
        >
          {FORM_SECTIONS.map((section) => (
            <EventTypeSectionCard
              key={section.id}
              section={section}
              open={openSections[section.id]}
              onToggle={() => toggleSection(section.id)}
            >
              {renderSection(section.id)}
            </EventTypeSectionCard>
          ))}
        </form>

        <div className="lg:col-span-2">
          <EventTypePreview
            mode={mode}
            eventTypeId={initialEventType?.id}
            hostProfile={hostProfile}
            values={values}
          />
        </div>
      </div>

      {serverError ? (
        <div
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {serverError}
        </div>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" form={editorFormId} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
