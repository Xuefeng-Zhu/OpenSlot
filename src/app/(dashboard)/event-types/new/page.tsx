"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Clock,
  MapPin,
  FileText,
  CalendarDays,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookingSummaryCard } from "@/components/booking/booking-summary-card";
import { useToast } from "@/components/ui/use-toast";

interface FormSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
}

export default function NewEventTypePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [locationType, setLocationType] = useState("online");
  const [locationValue, setLocationValue] = useState("");
  const [minNotice, setMinNotice] = useState(60);
  const [maxDaysAhead, setMaxDaysAhead] = useState(60);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  // Collapsible sections
  const [sections, setSections] = useState<FormSection[]>([
    { id: "basics", title: "Basics", icon: <FileText className="h-4 w-4" />, open: true },
    { id: "duration", title: "Duration & Buffers", icon: <Clock className="h-4 w-4" />, open: false },
    { id: "location", title: "Location", icon: <MapPin className="h-4 w-4" />, open: false },
    { id: "scheduling", title: "Scheduling Limits", icon: <CalendarDays className="h-4 w-4" />, open: false },
    { id: "questions", title: "Invitee Questions", icon: <MessageSquare className="h-4 w-4" />, open: false },
    { id: "confirmation", title: "Confirmation", icon: <CheckCircle className="h-4 w-4" />, open: false },
  ]);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, open: !s.open } : s))
    );
  };

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;

      const { [field]: _removed, ...next } = prev;
      return next;
    });
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!slug.trim()) newErrors.slug = "URL slug is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    toast({
      title: "Event type created",
      description: `"${title}" has been created successfully.`,
    });
    router.push("/event-types");
  };

  const handleCancel = () => {
    router.push("/event-types");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Event Type</h1>
        <p className="text-muted-foreground">
          Set up a new event type that guests can book.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form - left side */}
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
                          onChange={(e) => {
                            const value = e.target.value;
                            setTitle(value);
                            if (value.trim()) clearFieldError("title");
                          }}
                          placeholder="e.g. 30-min Discovery Call"
                        />
                        {errors.title && (
                          <p className="text-xs text-destructive mt-1">{errors.title}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="slug">URL Slug</Label>
                        <Input
                          id="slug"
                          value={slug}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSlug(value);
                            if (value.trim()) clearFieldError("slug");
                          }}
                          placeholder="e.g. discovery-call"
                        />
                        {errors.slug && (
                          <p className="text-xs text-destructive mt-1">{errors.slug}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe what this meeting is about..."
                          rows={3}
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
                          onChange={(e) => setDuration(Number(e.target.value))}
                          min={5}
                          max={480}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="buffer-before">Buffer before (min)</Label>
                          <Input
                            id="buffer-before"
                            type="number"
                            value={bufferBefore}
                            onChange={(e) => setBufferBefore(Number(e.target.value))}
                            min={0}
                          />
                        </div>
                        <div>
                          <Label htmlFor="buffer-after">Buffer after (min)</Label>
                          <Input
                            id="buffer-after"
                            type="number"
                            value={bufferAfter}
                            onChange={(e) => setBufferAfter(Number(e.target.value))}
                            min={0}
                          />
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
                          onChange={(e) => setLocationType(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="online">Online (Video)</option>
                          <option value="phone">Phone</option>
                          <option value="in_person">In Person</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="location-value">Location details</Label>
                        <Input
                          id="location-value"
                          value={locationValue}
                          onChange={(e) => setLocationValue(e.target.value)}
                          placeholder="e.g. Zoom link, address, or phone number"
                        />
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
                          onChange={(e) => setMinNotice(Number(e.target.value))}
                          min={0}
                        />
                      </div>
                      <div>
                        <Label htmlFor="max-days">Max days ahead</Label>
                        <Input
                          id="max-days"
                          type="number"
                          value={maxDaysAhead}
                          onChange={(e) => setMaxDaysAhead(Number(e.target.value))}
                          min={1}
                        />
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
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="confirmation-message">Confirmation message</Label>
                        <Textarea
                          id="confirmation-message"
                          value={confirmationMessage}
                          onChange={(e) => setConfirmationMessage(e.target.value)}
                          placeholder="Custom message shown after booking..."
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Live preview - right side */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Live Preview
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="lg:hidden"
              >
                {showPreview ? (
                  <EyeOff className="h-4 w-4 mr-1" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
                )}
                {showPreview ? "Hide" : "Show"} preview
              </Button>
            </div>
            {showPreview && (
              <BookingSummaryCard
                hostName="John Doe"
                eventTitle={title || "Event Title"}
                date="Mon, Jan 20, 2025"
                time="10:00 AM"
                duration={duration}
                timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
              />
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 bg-background border-t border-border py-4 -mx-6 px-6 flex items-center justify-end gap-3">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
}
