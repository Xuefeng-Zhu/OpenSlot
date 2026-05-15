"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
import { PageHeader } from "@/components/dashboard/page-header";
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
import { useToast } from "@/components/ui/use-toast";
import type { CalendarConnectionSummary } from "@/lib/calendar/connections";
import {
  eventTypeSchema,
  type EventLocationType,
  type EventTypeFormValues,
  type VideoProvider,
} from "@/lib/validations/event-type";
import {
  INVITEE_QUESTION_LIMIT,
  type InviteeQuestion,
  type InviteeQuestionType,
} from "@/lib/validations/invitee-questions";

interface FormSection {
  id: "basics" | "duration" | "location" | "scheduling" | "questions" | "confirmation";
  title: string;
  icon: ReactNode;
  open: boolean;
}

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
}

interface EventTypeEditorProps {
  mode: "create" | "edit";
  hostName: string;
  initialEventType?: EditableEventType;
  calendarConnections?: CalendarConnectionSummary[];
}

type FieldErrors = Partial<Record<keyof EventTypeFormValues, string>>;
type ApiResponse = {
  error?: string;
  details?: Partial<Record<keyof EventTypeFormValues, string[]>>;
};

const defaultEventType: Omit<EditableEventType, "id"> = {
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
};

function firstFieldErrors(
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

/**
 * Create/edit form for event types with live preview and shared API schema
 * validation. Server field errors are mapped back onto the same form fields used
 * for client-side validation.
 */
export function EventTypeEditor({
  mode,
  hostName,
  initialEventType,
  calendarConnections = [],
}: EventTypeEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const source = initialEventType ?? defaultEventType;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState(source.title);
  const [slug, setSlug] = useState(source.slug);
  const [description, setDescription] = useState(source.description);
  const [duration, setDuration] = useState(source.duration_minutes);
  const [bufferBefore, setBufferBefore] = useState(
    source.buffer_before_minutes
  );
  const [bufferAfter, setBufferAfter] = useState(source.buffer_after_minutes);
  const [locationType, setLocationType] =
    useState<EventTypeFormValues["location_type"]>(source.location_type);
  const [locationValue, setLocationValue] = useState(source.location_value);
  const [videoProvider, setVideoProvider] =
    useState<EventTypeFormValues["video_provider"]>(
      source.video_provider ?? null
    );
  const [inviteeQuestions, setInviteeQuestions] = useState<InviteeQuestion[]>(
    source.invitee_questions
  );
  const [minNotice, setMinNotice] = useState(source.min_notice_minutes);
  const [maxDaysAhead, setMaxDaysAhead] = useState(
    source.max_booking_days_ahead
  );
  const [isActive, setIsActive] = useState(source.is_active);

  const [sections, setSections] = useState<FormSection[]>([
    { id: "basics", title: "Basics", icon: <FileText className="h-4 w-4" />, open: true },
    { id: "duration", title: "Duration & Buffers", icon: <Clock className="h-4 w-4" />, open: false },
    { id: "location", title: "Location", icon: <MapPin className="h-4 w-4" />, open: false },
    { id: "scheduling", title: "Scheduling Limits", icon: <CalendarDays className="h-4 w-4" />, open: false },
    { id: "questions", title: "Invitee Questions", icon: <MessageSquare className="h-4 w-4" />, open: false },
    { id: "confirmation", title: "Confirmation", icon: <CheckCircle className="h-4 w-4" />, open: false },
  ]);

  const toggleSection = (id: FormSection["id"]) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, open: !section.open } : section
      )
    );
  };

  const clearFieldError = (field: keyof EventTypeFormValues) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;

      const { [field]: _removed, ...next } = prev;
      return next;
    });
  };

  const addQuestion = () => {
    setInviteeQuestions((prev) => [
      ...prev,
      {
        id: createQuestionId(),
        label: "",
        type: "text",
        required: false,
        options: [],
      },
    ]);
    clearFieldError("invitee_questions");
  };

  const removeQuestion = (questionId: string) => {
    setInviteeQuestions((prev) =>
      prev.filter((question) => question.id !== questionId)
    );
    clearFieldError("invitee_questions");
  };

  const updateQuestion = (
    questionId: string,
    patch: Partial<InviteeQuestion>
  ) => {
    setInviteeQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      )
    );
    clearFieldError("invitee_questions");
  };

  const updateQuestionType = (
    questionId: string,
    type: InviteeQuestionType
  ) => {
    setInviteeQuestions((prev) =>
      prev.map((question) => {
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
      })
    );
    clearFieldError("invitee_questions");
  };

  const updateQuestionOptions = (questionId: string, value: string) => {
    updateQuestion(questionId, {
      options: value
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean),
    });
  };

  const buildPayload = () => ({
    title: title.trim(),
    slug: slug.trim(),
    description: description.trim(),
    duration_minutes: duration,
    buffer_before_minutes: bufferBefore,
    buffer_after_minutes: bufferAfter,
    min_notice_minutes: minNotice,
    max_booking_days_ahead: maxDaysAhead,
    location_type: locationType,
    location_value: locationValue.trim(),
    video_provider: locationType === "video_provider" ? videoProvider : null,
    invitee_questions: inviteeQuestions,
    is_active: isActive,
  });

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
  const locationSelectValue =
    locationType === "video_provider" ? videoProvider ?? "google_meet" : locationType;
  const selectedVideoHealth = videoProvider
    ? videoProviderHealth(videoProvider, calendarConnections)
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title={mode === "create" ? "Create event type" : "Edit event type"}
        description={
          mode === "create"
            ? "Set up a focused booking option guests can understand at a glance."
            : `Update the settings for "${title || source.title}".`
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          {sections.map((section) => (
            <Card key={section.id}>
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
                aria-expanded={section.open}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground" aria-hidden="true">
                    {section.icon}
                  </span>
                  <span className="text-sm font-medium">{section.title}</span>
                </div>
                {section.open ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
              {section.open && (
                <CardContent className="pt-0 pb-4 px-4">
                  {section.id === "basics" && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Title</Label>
                        <Input
                          id="title"
                          value={title}
                          onChange={(event) => {
                            setTitle(event.target.value);
                            if (event.target.value.trim()) {
                              clearFieldError("title");
                            }
                          }}
                          placeholder="e.g. 30-min Discovery Call"
                        />
                        {errors.title && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.title}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="slug">URL Slug</Label>
                        <Input
                          id="slug"
                          value={slug}
                          onChange={(event) => {
                            setSlug(event.target.value);
                            if (event.target.value.trim()) {
                              clearFieldError("slug");
                            }
                          }}
                          placeholder="e.g. discovery-call"
                        />
                        {errors.slug && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.slug}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(event) => {
                            setDescription(event.target.value);
                            clearFieldError("description");
                          }}
                          placeholder="Describe what this meeting is about..."
                          rows={3}
                        />
                        {errors.description && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.description}
                          </p>
                        )}
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
                          checked={isActive}
                          onCheckedChange={setIsActive}
                          aria-label="Visible to guests"
                        />
                      </div>
                    </div>
                  )}
                  {section.id === "duration" && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="duration">Duration (minutes)</Label>
                        <Input
                          id="duration"
                          type="number"
                          value={duration}
                          onChange={(event) => {
                            setDuration(Number(event.target.value));
                            clearFieldError("duration_minutes");
                          }}
                          min={1}
                          max={480}
                        />
                        {errors.duration_minutes && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.duration_minutes}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="buffer-before">Buffer before (min)</Label>
                          <Input
                            id="buffer-before"
                            type="number"
                            value={bufferBefore}
                            onChange={(event) => {
                              setBufferBefore(Number(event.target.value));
                              clearFieldError("buffer_before_minutes");
                            }}
                            min={0}
                          />
                          {errors.buffer_before_minutes && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.buffer_before_minutes}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="buffer-after">Buffer after (min)</Label>
                          <Input
                            id="buffer-after"
                            type="number"
                            value={bufferAfter}
                            onChange={(event) => {
                              setBufferAfter(Number(event.target.value));
                              clearFieldError("buffer_after_minutes");
                            }}
                            min={0}
                          />
                          {errors.buffer_after_minutes && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.buffer_after_minutes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {section.id === "location" && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="location-type">Location type</Label>
                        <select
                          id="location-type"
                          value={locationSelectValue}
                          onChange={(event) => {
                            const nextValue = event.target.value;

                            if (
                              nextValue === "google_meet" ||
                              nextValue === "microsoft_teams"
                            ) {
                              setLocationType("video_provider");
                              setVideoProvider(nextValue);
                              setLocationValue("");
                              clearFieldError("video_provider");
                              clearFieldError("location_value");
                            } else {
                              setLocationType(nextValue as EventLocationType);
                              setVideoProvider(null);
                            }

                            clearFieldError("location_type");
                          }}
                          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="custom">Custom link</option>
                          <option value="phone">Phone</option>
                          <option value="in_person">In Person</option>
                          <option value="google_meet">Google Meet</option>
                          <option value="microsoft_teams">Microsoft Teams</option>
                          <option value="online">Online (manual)</option>
                        </select>
                        {errors.location_type && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.location_type}
                          </p>
                        )}
                        {errors.video_provider && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.video_provider}
                          </p>
                        )}
                        {selectedVideoHealth && (
                          <p
                            className={`mt-2 text-xs ${
                              selectedVideoHealth.ready
                                ? "text-success"
                                : "text-amber-600"
                            }`}
                          >
                            {selectedVideoHealth.message}
                          </p>
                        )}
                      </div>
                      {locationType !== "video_provider" && (
                        <div>
                          <Label htmlFor="location-value">Location details</Label>
                          <Input
                            id="location-value"
                            value={locationValue}
                            onChange={(event) => {
                              setLocationValue(event.target.value);
                              clearFieldError("location_value");
                            }}
                            placeholder={locationPlaceholder(locationType)}
                          />
                          {errors.location_value && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.location_value}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {section.id === "scheduling" && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="min-notice">Minimum notice (minutes)</Label>
                        <Input
                          id="min-notice"
                          type="number"
                          value={minNotice}
                          onChange={(event) => {
                            setMinNotice(Number(event.target.value));
                            clearFieldError("min_notice_minutes");
                          }}
                          min={0}
                        />
                        {errors.min_notice_minutes && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.min_notice_minutes}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="max-days">Max days ahead</Label>
                        <Input
                          id="max-days"
                          type="number"
                          value={maxDaysAhead}
                          onChange={(event) => {
                            setMaxDaysAhead(Number(event.target.value));
                            clearFieldError("max_booking_days_ahead");
                          }}
                          min={1}
                        />
                        {errors.max_booking_days_ahead && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.max_booking_days_ahead}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {section.id === "questions" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            Booking questions
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inviteeQuestions.length}/{INVITEE_QUESTION_LIMIT} configured
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addQuestion}
                          disabled={
                            inviteeQuestions.length >= INVITEE_QUESTION_LIMIT
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                          Add question
                        </Button>
                      </div>

                      {inviteeQuestions.length === 0 && (
                        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                          No custom questions yet.
                        </div>
                      )}

                      {inviteeQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          className="space-y-4 rounded-md border border-border p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                Question {index + 1}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {question.required ? "Required" : "Optional"}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove question ${index + 1}`}
                              onClick={() => removeQuestion(question.id)}
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
                                updateQuestion(question.id, {
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
                                  updateQuestionType(
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
                                  updateQuestion(question.id, { required })
                                }
                                aria-label={`Question ${index + 1} required`}
                              />
                            </div>
                          </div>

                          {question.type === "select" && (
                            <div>
                              <Label htmlFor={`question-options-${question.id}`}>
                                Options
                              </Label>
                              <Textarea
                                id={`question-options-${question.id}`}
                                value={question.options.join("\n")}
                                onChange={(event) =>
                                  updateQuestionOptions(
                                    question.id,
                                    event.target.value
                                  )
                                }
                                rows={3}
                              />
                            </div>
                          )}
                        </div>
                      ))}

                      {errors.invitee_questions && (
                        <p className="text-xs text-destructive">
                          {errors.invitee_questions}
                        </p>
                      )}
                    </div>
                  )}
                  {section.id === "confirmation" && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Custom confirmation messages will be available in a future update.
                      </p>
                      <Badge variant="secondary">Coming soon</Badge>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Live preview
              </h2>
            </div>
            <BookingSummaryCard
              hostName={hostName}
              eventTitle={title || "Event Title"}
              description={description}
              urlSlug={slug}
              visibility={isActive ? "Visible to guests" : "Hidden from guests"}
              duration={duration}
              bufferBefore={bufferBefore}
              bufferAfter={bufferAfter}
              minNotice={minNotice}
              maxDaysAhead={maxDaysAhead}
              timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
              showTimezone={false}
              locationType={locationPreviewType(locationType, videoProvider)}
              locationDetails={locationPreviewDetails(
                locationType,
                locationValue,
                selectedVideoHealth?.message
              )}
              questions={inviteeQuestions}
            />
          </div>
        </div>
      </div>

      {serverError && (
        <div
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {serverError}
        </div>
      )}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function locationPlaceholder(locationType: EventTypeFormValues["location_type"]) {
  if (locationType === "phone") return "e.g. +1 555 123 4567";
  if (locationType === "in_person") return "e.g. 123 Market Street";
  if (locationType === "custom") return "e.g. https://example.com/meeting";
  return "e.g. Online meeting details";
}

function locationPreviewType(
  locationType: EventTypeFormValues["location_type"],
  videoProvider: EventTypeFormValues["video_provider"]
) {
  if (locationType === "video_provider") {
    return videoProvider === "microsoft_teams" ? "Microsoft Teams" : "Google Meet";
  }

  if (locationType === "in_person") return "In person";
  if (locationType === "custom") return "Custom link";
  if (locationType === "phone") return "Phone";
  return "Online (manual)";
}

function locationPreviewDetails(
  locationType: EventTypeFormValues["location_type"],
  locationValue: string,
  videoStatusMessage?: string
) {
  if (locationType === "video_provider") {
    return videoStatusMessage ?? "Generated automatically for new bookings";
  }

  return locationValue.trim() || "Not set";
}

function videoProviderHealth(
  provider: VideoProvider,
  connections: CalendarConnectionSummary[]
): { ready: boolean; message: string } {
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

function createQuestionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replaceAll("-", "");
  }

  return `q_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
