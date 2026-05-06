"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Eye,
  Globe2,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";

import {
  AvatarPhoto,
  MiniCalendar,
  PoweredByOpenSlot,
} from "@/components/brand/booking-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function EditEventTypePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("Product Demo");
  const [slug, setSlug] = useState("product-demo");
  const [description, setDescription] = useState(
    "Discover how OpenSlot can help your team schedule smarter and eliminate double-booking."
  );
  const [duration, setDuration] = useState("30 min");

  const handleSave = () => {
    toast({
      title: "Event type saved",
      description: `${title} has been updated.`,
    });
    router.push("/event-types");
  };

  return (
    <div className="mx-auto max-w-[1220px] space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" className="mb-3 px-0 text-primary" onClick={() => router.push("/event-types")}>
            Back to event types
          </Button>
          <h1 className="text-3xl font-extrabold text-foreground">
            Edit event type
          </h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            Update your event type details and how it is scheduled.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
            Preview
          </Button>
          <Button variant="outline" size="icon" aria-label="More options">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <div className="space-y-5">
          <EditorSection
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            title="Basics"
            description="Define the essentials of your event type."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  openslot.com/sarahchen/{slug}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
              />
              <p className="mt-2 text-right text-xs font-medium text-muted-foreground">
                {description.length}/500
              </p>
            </div>
          </EditorSection>

          <EditorSection
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
            title="Duration and buffers"
            description="Set how long the event lasts and add buffer time."
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_180px_180px]">
              <div>
                <Label>Duration</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["15 min", "30 min", "45 min", "60 min", "Custom"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDuration(item)}
                      className={`h-10 rounded-[9px] border px-4 text-sm font-bold ${
                        duration === item
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-white text-foreground"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <SelectLike label="Buffer before" value="15 min" />
              <SelectLike label="Buffer after" value="15 min" />
            </div>
          </EditorSection>

          <EditorSection
            icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
            title="Location"
            description="Choose where this event takes place."
          >
            <Label>Location type</Label>
            <div className="mt-2 grid gap-3 md:grid-cols-5">
              {[
                { label: "Google Meet", icon: Video, active: true },
                { label: "Zoom", icon: Video },
                { label: "Phone call", icon: Phone },
                { label: "In-person", icon: User },
                { label: "Custom", icon: MoreHorizontal },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`flex h-11 items-center justify-center gap-2 rounded-[9px] border text-sm font-bold ${
                    item.active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-white text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm font-medium text-muted-foreground">
              <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 accent-primary" />
              Generate a new Google Meet link for each booking. A unique link
              will be created automatically.
            </label>
          </EditorSection>

          <EditorSection
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            title="Scheduling limits"
            description="Control when people can book this event."
          >
            <div className="grid gap-4 md:grid-cols-4">
              <SelectLike label="Minimum notice" value="2 hours" />
              <SelectLike label="Maximum notice" value="30 days" />
              <SelectLike label="Maximum bookings per day" value="10" />
              <SelectLike label="Busy slot policy" value="Prevent double-booking" />
            </div>
          </EditorSection>

          <EditorSection
            icon={<User className="h-5 w-5" aria-hidden="true" />}
            title="Invitee questions"
            description="Collect helpful information from invitees."
            action={<Switch defaultChecked aria-label="Collect questions" />}
          >
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add question
            </Button>
          </EditorSection>
        </div>

        <aside className="h-fit rounded-[16px] border border-border bg-white p-5 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500" />
            <div>
              <h2 className="font-extrabold text-foreground">Live preview</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                This is how invitees will see your event type.
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-[14px] border border-border p-5">
            <AvatarPhoto className="h-16 w-16" />
            <p className="mt-4 text-sm font-bold text-foreground">Sarah Chen</p>
            <h3 className="mt-2 text-2xl font-extrabold text-foreground">
              {title}
            </h3>
            <div className="mt-4 space-y-3 text-sm font-bold text-muted-foreground">
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                {duration}
              </span>
              <span className="flex items-center gap-2">
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                Web conferencing details provided upon confirmation.
              </span>
            </div>
            <p className="mt-5 text-sm font-medium leading-6 text-muted-foreground">
              {description}
            </p>
            <div className="my-6 h-px bg-border" />
            <h4 className="font-extrabold text-foreground">Select a date and time</h4>
            <MiniCalendar compact className="mt-5" />
            <div className="mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              Timezone: America/New_York (EDT)
            </div>
            <div className="mt-5 border-t border-border pt-5">
              <PoweredByOpenSlot />
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-5 py-4 shadow-lg backdrop-blur sm:px-8 lg:pl-[320px] lg:pr-10">
        <div className="mx-auto flex max-w-[1220px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-foreground">
              You have unsaved changes
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              Make sure to save your changes before leaving.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push("/event-types")}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save event type</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-white">
      <CardContent className="p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <h2 className="font-extrabold text-foreground">{title}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <button
        type="button"
        className="mt-2 h-11 w-full rounded-[10px] border border-border bg-white px-3 text-left text-sm font-bold text-foreground shadow-sm"
      >
        {value}
      </button>
    </div>
  );
}
