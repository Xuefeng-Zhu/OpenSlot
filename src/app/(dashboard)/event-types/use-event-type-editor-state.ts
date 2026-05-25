"use client";

import { useCallback, useState } from "react";
import type { EventLocationType } from "@/lib/validations/event-type";
import {
  INVITEE_QUESTION_LIMIT,
  type InviteeQuestion,
  type InviteeQuestionType,
} from "@/lib/validations/invitee-questions";
import {
  buildEventTypePayload,
  createEventTypeEditorState,
  createQuestionId,
  type EditableEventType,
  type EventTypeEditorFormState,
  type FieldErrors,
  isVideoProviderValue,
  type UpdateEventTypeEditorField,
} from "./event-type-editor-model";

export function useEventTypeEditorState(
  initialEventType?: EditableEventType,
  defaultScheduleId = ""
) {
  const [values, setValues] = useState<EventTypeEditorFormState>(() =>
    createEventTypeEditorState(initialEventType, defaultScheduleId)
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;

      const { [field]: _removed, ...next } = prev;
      return next;
    });
  }, []);

  const updateField: UpdateEventTypeEditorField = useCallback(
    (field, value) => {
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const addQuestion = useCallback(() => {
    setValues((prev) => {
      if (prev.invitee_questions.length >= INVITEE_QUESTION_LIMIT) {
        return prev;
      }

      return {
        ...prev,
        invitee_questions: [
          ...prev.invitee_questions,
          {
            id: createQuestionId(),
            label: "",
            type: "text",
            required: false,
            options: [],
          },
        ],
      };
    });
    clearFieldError("invitee_questions");
  }, [clearFieldError]);

  const removeQuestion = useCallback(
    (questionId: string) => {
      setValues((prev) => ({
        ...prev,
        invitee_questions: prev.invitee_questions.filter(
          (question) => question.id !== questionId
        ),
      }));
      clearFieldError("invitee_questions");
    },
    [clearFieldError]
  );

  const updateQuestion = useCallback(
    (questionId: string, patch: Partial<InviteeQuestion>) => {
      setValues((prev) => ({
        ...prev,
        invitee_questions: prev.invitee_questions.map((question) =>
          question.id === questionId ? { ...question, ...patch } : question
        ),
      }));
      clearFieldError("invitee_questions");
    },
    [clearFieldError]
  );

  const updateQuestionType = useCallback(
    (questionId: string, type: InviteeQuestionType) => {
      setValues((prev) => ({
        ...prev,
        invitee_questions: prev.invitee_questions.map((question) => {
          if (question.id !== questionId) return question;

          return {
            ...question,
            type,
            options:
              type === "select"
                ? question.options.length >= 2
                  ? question.options
                  : ["Option 1", "Option 2"]
                : [],
          };
        }),
      }));
      clearFieldError("invitee_questions");
    },
    [clearFieldError]
  );

  const updateQuestionOptions = useCallback(
    (questionId: string, value: string) => {
      updateQuestion(questionId, {
        options: value
          .split("\n")
          .map((option) => option.trim())
          .filter(Boolean),
      });
    },
    [updateQuestion]
  );

  const selectLocation = useCallback(
    (nextValue: string) => {
      setValues((prev) => {
        if (isVideoProviderValue(nextValue)) {
          return {
            ...prev,
            location_type: "video_provider",
            video_provider: nextValue,
            location_value: "",
          };
        }

        const nextLocationType = nextValue as EventLocationType;
        return {
          ...prev,
          location_type: nextLocationType,
          video_provider: null,
          location_value:
            prev.location_type === nextLocationType ? prev.location_value : "",
        };
      });

      clearFieldError("location_type");
      clearFieldError("video_provider");
      clearFieldError("location_value");
    },
    [clearFieldError]
  );

  const buildPayload = useCallback(
    () => buildEventTypePayload(values),
    [values]
  );

  return {
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
  };
}
