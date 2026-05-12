"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileText,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { BookingSummaryCard } from "@/components/booking/booking-summary-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  eventTypeSchema,
  type EventTypeFormValues,
} from "@/lib/validations/event-type";

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
  is_active: boolean;
}

interface EventTypeEditorProps {
  mode: "create" | "edit";
  hostName: string;
  initialEventType?: EditableEventType;
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
 * Create/edit form for event types with local preview state and shared API schema
 * validation. Server field errors are mapped back onto the same form fields used
 * for client-side validation.
 */
export function EventTypeEditor({
  mode,
  hostName,
  initialEventType,
}: EventTypeEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const source = initialEventType ?? defaultEventType;
  const [showPreview, setShowPreview] = useState(true);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title={mode === "create" ? "Create event type" : "Edit event type"}
        description={
          mode === "create"
            ? "Set up a focused booking option guests can understand at a glance."
            : `Update the settings for "${title || source.title}".`
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {showPreview ? "Hide" : "Show"} preview
          </Button>
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
                          value={locationType}
                          onChange={(event) => {
                            setLocationType(
                              event.target
                                .value as EventTypeFormValues["location_type"]
                            );
                            clearFieldError("location_type");
                          }}
                          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="online">Online (Video)</option>
                          <option value="phone">Phone</option>
                          <option value="in_person">In Person</option>
                          <option value="custom">Custom</option>
                        </select>
                        {errors.location_type && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.location_type}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="location-value">Location details</Label>
                        <Input
                          id="location-value"
                          value={locationValue}
                          onChange={(event) => {
                            setLocationValue(event.target.value);
                            clearFieldError("location_value");
                          }}
                          placeholder="e.g. Zoom link, address, or phone number"
                        />
                        {errors.location_value && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.location_value}
                          </p>
                        )}
                      </div>
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
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Custom invitee questions will be available in a future update.
                      </p>
                      <Badge variant="secondary">Coming soon</Badge>
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
            {showPreview && (
              <BookingSummaryCard
                hostName={hostName}
                eventTitle={title || "Event Title"}
                date="Fri, May 15, 2026"
                time="10:00 AM"
                duration={duration}
                timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
              />
            )}
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
