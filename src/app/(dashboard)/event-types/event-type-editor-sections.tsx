"use client";

import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { BookingSummaryCard } from "@/components/booking/booking-summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  INVITEE_QUESTION_LIMIT,
  type InviteeQuestion,
  type InviteeQuestionType,
} from "@/lib/validations/invitee-questions";
import {
  type EventTypeEditorFormState,
  type FieldErrors,
  locationPlaceholder,
  locationPreviewDetails,
  locationPreviewType,
  type UpdateEventTypeEditorField,
  type VideoProviderHealth,
} from "./event-type-editor-model";

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

export const FORM_SECTIONS: readonly FormSection[] = [
  {
    id: "basics",
    title: "Basics",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "duration",
    title: "Duration & Buffers",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "location",
    title: "Location",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    id: "scheduling",
    title: "Scheduling Limits",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    id: "reminders",
    title: "Reminders",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: "questions",
    title: "Invitee Questions",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    id: "confirmation",
    title: "Confirmation",
    icon: <CheckCircle className="h-4 w-4" />,
  },
];

interface EventTypeSectionCardProps {
  section: FormSection;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

interface EventTypeSectionProps {
  values: EventTypeEditorFormState;
  errors: FieldErrors;
  onFieldChange: UpdateEventTypeEditorField;
  clearFieldError: (field: keyof FieldErrors) => void;
}

export function EventTypeSectionCard({
  section,
  open,
  onToggle,
  children,
}: EventTypeSectionCardProps) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground" aria-hidden="true">
            {section.icon}
          </span>
          <span className="text-sm font-medium">{section.title}</span>
        </div>
        {open ? (
          <ChevronDown
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </button>
      {open ? <CardContent className="pt-0 pb-4 px-4">{children}</CardContent> : null}
    </Card>
  );
}

export function BasicsSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(event) => {
            onFieldChange("title", event.target.value);
            if (event.target.value.trim()) {
              clearFieldError("title");
            }
          }}
          placeholder="e.g. 30-min Discovery Call"
        />
        {errors.title ? (
          <p className="text-xs text-destructive mt-1">{errors.title}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="slug">URL Slug</Label>
        <Input
          id="slug"
          value={values.slug}
          onChange={(event) => {
            onFieldChange("slug", event.target.value);
            if (event.target.value.trim()) {
              clearFieldError("slug");
            }
          }}
          placeholder="e.g. discovery-call"
        />
        {errors.slug ? (
          <p className="text-xs text-destructive mt-1">{errors.slug}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(event) => {
            onFieldChange("description", event.target.value);
            clearFieldError("description");
          }}
          placeholder="Describe what this meeting is about..."
          rows={3}
        />
        {errors.description ? (
          <p className="text-xs text-destructive mt-1">
            {errors.description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label htmlFor="is-active">Visible to guests</Label>
          <p className="text-xs text-muted-foreground">
            Paused event types stay editable but are hidden from public booking pages.
          </p>
        </div>
        <Switch
          id="is-active"
          checked={values.is_active}
          onCheckedChange={(checked) => onFieldChange("is_active", checked)}
          aria-label="Visible to guests"
        />
      </div>
    </div>
  );
}

export function DurationBuffersSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input
          id="duration"
          type="number"
          value={values.duration_minutes}
          onChange={(event) => {
            onFieldChange("duration_minutes", Number(event.target.value));
            clearFieldError("duration_minutes");
          }}
          min={1}
          max={480}
        />
        {errors.duration_minutes ? (
          <p className="text-xs text-destructive mt-1">
            {errors.duration_minutes}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="buffer-before">Buffer before (min)</Label>
          <Input
            id="buffer-before"
            type="number"
            value={values.buffer_before_minutes}
            onChange={(event) => {
              onFieldChange("buffer_before_minutes", Number(event.target.value));
              clearFieldError("buffer_before_minutes");
            }}
            min={0}
          />
          {errors.buffer_before_minutes ? (
            <p className="text-xs text-destructive mt-1">
              {errors.buffer_before_minutes}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="buffer-after">Buffer after (min)</Label>
          <Input
            id="buffer-after"
            type="number"
            value={values.buffer_after_minutes}
            onChange={(event) => {
              onFieldChange("buffer_after_minutes", Number(event.target.value));
              clearFieldError("buffer_after_minutes");
            }}
            min={0}
          />
          {errors.buffer_after_minutes ? (
            <p className="text-xs text-destructive mt-1">
              {errors.buffer_after_minutes}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface LocationSectionProps extends EventTypeSectionProps {
  selectedVideoHealth: VideoProviderHealth | null;
  onLocationSelectChange: (value: string) => void;
}

export function LocationSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
  selectedVideoHealth,
  onLocationSelectChange,
}: LocationSectionProps) {
  const locationSelectValue =
    values.location_type === "video_provider"
      ? values.video_provider ?? "google_meet"
      : values.location_type;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="location-type">Location type</Label>
        <select
          id="location-type"
          value={locationSelectValue}
          onChange={(event) => onLocationSelectChange(event.target.value)}
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="custom">Custom link</option>
          <option value="phone">Phone</option>
          <option value="in_person">In Person</option>
          <option value="google_meet">Google Meet</option>
          <option value="microsoft_teams">Microsoft Teams</option>
          <option value="online">Online (manual)</option>
        </select>
        {errors.location_type ? (
          <p className="text-xs text-destructive mt-1">
            {errors.location_type}
          </p>
        ) : null}
        {errors.video_provider ? (
          <p className="text-xs text-destructive mt-1">
            {errors.video_provider}
          </p>
        ) : null}
        {selectedVideoHealth ? (
          <p
            className={`mt-2 text-xs ${
              selectedVideoHealth.ready ? "text-success" : "text-amber-600"
            }`}
          >
            {selectedVideoHealth.message}
          </p>
        ) : null}
      </div>
      {values.location_type !== "video_provider" ? (
        <div>
          <Label htmlFor="location-value">Location details</Label>
          <Input
            id="location-value"
            value={values.location_value}
            onChange={(event) => {
              onFieldChange("location_value", event.target.value);
              clearFieldError("location_value");
            }}
            placeholder={locationPlaceholder(values.location_type)}
          />
          {errors.location_value ? (
            <p className="text-xs text-destructive mt-1">
              {errors.location_value}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SchedulingLimitsSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="min-notice">Minimum notice (minutes)</Label>
        <Input
          id="min-notice"
          type="number"
          value={values.min_notice_minutes}
          onChange={(event) => {
            onFieldChange("min_notice_minutes", Number(event.target.value));
            clearFieldError("min_notice_minutes");
          }}
          min={0}
        />
        {errors.min_notice_minutes ? (
          <p className="text-xs text-destructive mt-1">
            {errors.min_notice_minutes}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="max-days">Max days ahead</Label>
        <Input
          id="max-days"
          type="number"
          value={values.max_booking_days_ahead}
          onChange={(event) => {
            onFieldChange("max_booking_days_ahead", Number(event.target.value));
            clearFieldError("max_booking_days_ahead");
          }}
          min={1}
        />
        {errors.max_booking_days_ahead ? (
          <p className="text-xs text-destructive mt-1">
            {errors.max_booking_days_ahead}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function RemindersSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label htmlFor="reminder-enabled">Pre-meeting reminder</Label>
          <p className="text-xs text-muted-foreground">
            Send one email reminder before this event starts.
          </p>
        </div>
        <Switch
          id="reminder-enabled"
          checked={values.reminder_enabled}
          onCheckedChange={(checked) => {
            onFieldChange("reminder_enabled", checked);
            clearFieldError("reminder_guest_enabled");
          }}
          aria-label="Enable pre-meeting reminders"
        />
      </div>
      <div>
        <Label htmlFor="reminder-minutes-before">
          Send before start (minutes)
        </Label>
        <Input
          id="reminder-minutes-before"
          type="number"
          value={values.reminder_minutes_before}
          onChange={(event) => {
            onFieldChange("reminder_minutes_before", Number(event.target.value));
            clearFieldError("reminder_minutes_before");
          }}
          min={5}
          max={10080}
          disabled={!values.reminder_enabled}
        />
        {errors.reminder_minutes_before ? (
          <p className="text-xs text-destructive mt-1">
            {errors.reminder_minutes_before}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Email guest</p>
            <p className="text-xs text-muted-foreground">
              Use the guest&apos;s booking email.
            </p>
          </div>
          <Switch
            checked={values.reminder_guest_enabled}
            onCheckedChange={(checked) => {
              onFieldChange("reminder_guest_enabled", checked);
              clearFieldError("reminder_guest_enabled");
            }}
            disabled={!values.reminder_enabled}
            aria-label="Email guest reminders"
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Email host</p>
            <p className="text-xs text-muted-foreground">
              Use your profile email.
            </p>
          </div>
          <Switch
            checked={values.reminder_host_enabled}
            onCheckedChange={(checked) => {
              onFieldChange("reminder_host_enabled", checked);
              clearFieldError("reminder_guest_enabled");
            }}
            disabled={!values.reminder_enabled}
            aria-label="Email host reminders"
          />
        </div>
      </div>
      {errors.reminder_guest_enabled ? (
        <p className="text-xs text-destructive">
          {errors.reminder_guest_enabled}
        </p>
      ) : null}
    </div>
  );
}

interface InviteeQuestionsSectionProps {
  questions: InviteeQuestion[];
  error?: string;
  onAddQuestion: () => void;
  onRemoveQuestion: (questionId: string) => void;
  onUpdateQuestion: (
    questionId: string,
    patch: Partial<InviteeQuestion>
  ) => void;
  onUpdateQuestionType: (
    questionId: string,
    type: InviteeQuestionType
  ) => void;
  onUpdateQuestionOptions: (questionId: string, value: string) => void;
}

export function InviteeQuestionsSection({
  questions,
  error,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onUpdateQuestionType,
  onUpdateQuestionOptions,
}: InviteeQuestionsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Booking questions</p>
          <p className="text-xs text-muted-foreground">
            {questions.length}/{INVITEE_QUESTION_LIMIT} configured
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddQuestion}
          disabled={questions.length >= INVITEE_QUESTION_LIMIT}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          No custom questions yet.
        </div>
      ) : null}

      {questions.map((question, index) => (
        <div
          key={question.id}
          className="space-y-4 rounded-md border border-border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Question {index + 1}</p>
              <p className="text-xs text-muted-foreground">
                {question.required ? "Required" : "Optional"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove question ${index + 1}`}
              onClick={() => onRemoveQuestion(question.id)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div>
            <Label htmlFor={`question-label-${question.id}`}>
              Question label
            </Label>
            <Input
              id={`question-label-${question.id}`}
              value={question.label}
              onChange={(event) =>
                onUpdateQuestion(question.id, {
                  label: event.target.value,
                })
              }
              placeholder="e.g. What would you like to discuss?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`question-type-${question.id}`}>
                Answer type
              </Label>
              <Select
                value={question.type}
                onValueChange={(value) =>
                  onUpdateQuestionType(
                    question.id,
                    value as InviteeQuestionType
                  )
                }
              >
                <SelectTrigger
                  id={`question-type-${question.id}`}
                  className="h-11 border-border bg-background shadow-sm"
                >
                  <SelectValue placeholder="Select answer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Short text</SelectItem>
                  <SelectItem value="textarea">Long text</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex h-10 items-center justify-between gap-3 sm:mt-6">
              <Label htmlFor={`question-required-${question.id}`}>
                Required
              </Label>
              <Switch
                id={`question-required-${question.id}`}
                checked={question.required}
                onCheckedChange={(required) =>
                  onUpdateQuestion(question.id, { required })
                }
                aria-label={`Question ${index + 1} required`}
              />
            </div>
          </div>

          {question.type === "select" ? (
            <div>
              <Label htmlFor={`question-options-${question.id}`}>
                Options
              </Label>
              <Textarea
                id={`question-options-${question.id}`}
                value={question.options.join("\n")}
                onChange={(event) =>
                  onUpdateQuestionOptions(question.id, event.target.value)
                }
                rows={3}
              />
            </div>
          ) : null}
        </div>
      ))}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function ConfirmationSection() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Custom confirmation messages will be available in a future update.
      </p>
      <Badge variant="secondary">Coming soon</Badge>
    </div>
  );
}

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
        visibility={values.is_active ? "Visible to guests" : "Hidden from guests"}
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
