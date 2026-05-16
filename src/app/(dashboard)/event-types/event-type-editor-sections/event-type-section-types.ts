import type { ReactNode } from "react";
import type {
  EventTypeEditorFormState,
  FieldErrors,
  UpdateEventTypeEditorField,
} from "../event-type-editor-model";

export type FormSectionId =
  | "basics"
  | "duration"
  | "location"
  | "scheduling"
  | "reminders"
  | "questions"
  | "confirmation";

export interface FormSection {
  id: FormSectionId;
  title: string;
  icon: ReactNode;
}

export interface EventTypeSectionProps {
  values: EventTypeEditorFormState;
  errors: FieldErrors;
  onFieldChange: UpdateEventTypeEditorField;
  clearFieldError: (field: keyof FieldErrors) => void;
}
