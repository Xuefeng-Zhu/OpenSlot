"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Globe2,
  Link2,
  Plus,
  User,
  Video,
} from "lucide-react";

import {
  AvatarPhoto,
  MiniCalendar,
  PoweredByOpenSlot,
  TimeSlots,
} from "@/components/brand/booking-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const steps = [
  {
    title: "Create public profile",
    subtitle: "Add your details",
    icon: User,
  },
  {
    title: "Set availability",
    subtitle: "When are you available?",
    icon: Clock3,
  },
  {
    title: "Create first event type",
    subtitle: "Define your meeting",
    icon: CalendarDays,
  },
  {
    title: "Share your link",
    subtitle: "Invite and get booked",
    icon: Link2,
  },
];

const days = [
  { label: "Monday", enabled: true, end: "5:00 PM" },
  { label: "Tuesday", enabled: true, end: "5:00 PM" },
  { label: "Wednesday", enabled: true, end: "5:00 PM" },
  { label: "Thursday", enabled: true, end: "5:00 PM" },
  { label: "Friday", enabled: true, end: "3:00 PM" },
  { label: "Saturday", enabled: false, end: "Unavailable" },
  { label: "Sunday", enabled: false, end: "Unavailable" },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("https://openslot.com/sarah-chen").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="mx-auto max-w-[1360px] px-5 py-8">
      <Card className="bg-white">
        <CardContent className="p-0">
          <Progress currentStep={currentStep} />
          <div className="grid gap-5 border-t border-border p-5 xl:grid-cols-[1.08fr_0.92fr]">
            <section className="rounded-[16px] border border-border bg-white p-6">
              {currentStep === 0 && <ProfileStep />}
              {currentStep === 1 && <AvailabilityStep />}
              {currentStep === 2 && <EventTypeStep />}
              {currentStep === 3 && (
                <ShareStep copied={copied} onCopy={handleCopy} />
              )}
            </section>
            <LivePreview copied={copied} onCopy={handleCopy} />
          </div>

          <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Times are shown in your time zone
              </div>
              <Button
                onClick={() => setCurrentStep((step) => Math.min(3, step + 1))}
              >
                {currentStep === 3 ? "Go to dashboard" : "View all steps"}
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col items-center justify-between gap-5 rounded-[18px] border border-primary/10 bg-primary/[0.07] px-8 py-6 sm:flex-row">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-white text-primary shadow-sm">
            <CalendarDays className="h-9 w-9" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-extrabold text-foreground">
              You are almost there!
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              Complete the next steps to start accepting bookings.
            </p>
          </div>
        </div>
        <Button variant="outline">View all steps</Button>
      </div>
    </div>
  );
}

function Progress({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Onboarding progress" className="p-7">
      <ol className="grid gap-5 md:grid-cols-4">
        {steps.map((step, index) => {
          const active = index === currentStep;
          const complete = index < currentStep;
          return (
            <li key={step.title} className="flex items-center gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold ${
                  active
                    ? "border-primary bg-primary text-white"
                    : complete
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border bg-white text-primary"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {complete ? <Check className="h-5 w-5" aria-hidden="true" /> : index + 1}
              </div>
              <div>
                <p className={`text-sm font-extrabold ${active ? "text-primary" : "text-foreground"}`}>
                  {step.title}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  {step.subtitle}
                </p>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="ml-auto hidden h-4 w-4 text-border md:block" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ProfileStep() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-foreground">
        Create your public profile
      </h1>
      <p className="mt-2 text-base font-medium text-muted-foreground">
        This information will be visible on your booking page.
      </p>
      <div className="mt-8 grid gap-5">
        <div>
          <Label htmlFor="display-name">Display name</Label>
          <Input id="display-name" placeholder="Sarah Chen" />
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="sarah-chen" />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={4} placeholder="Tell people what they can book you for." />
        </div>
      </div>
    </div>
  );
}

function AvailabilityStep() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-foreground">
        Set your availability
      </h1>
      <p className="mt-2 text-base font-medium text-muted-foreground">
        Let people know when you are available for bookings.
      </p>

      <div className="mt-8 border-y border-border py-5">
        <div className="grid gap-4 md:grid-cols-[1fr_230px] md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
              <Globe2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="font-extrabold text-foreground">Timezone</p>
              <p className="text-sm font-medium text-muted-foreground">
                This helps us show times in your local time and local time for each invitee.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="h-11 rounded-[10px] border border-border bg-white px-4 text-sm font-bold text-muted-foreground shadow-sm"
          >
            America/New_York (EDT)
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
              <Clock3 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="font-extrabold text-foreground">Weekly availability</p>
              <p className="text-sm font-medium text-muted-foreground">
                Set the days and times you are usually available.
              </p>
            </div>
          </div>
          <Button variant="ghost" className="hidden text-primary md:inline-flex">
            Copy availability from...
          </Button>
        </div>

        <div className="space-y-3">
          {days.map((day) => (
            <div
              key={day.label}
              className="grid gap-3 rounded-[12px] px-1 py-1 md:grid-cols-[190px_1fr_auto_auto] md:items-center"
            >
              <div className="flex items-center gap-3">
                <Switch checked={day.enabled} aria-label={`${day.label} availability`} />
                <span className="text-sm font-extrabold text-foreground">
                  {day.label}
                </span>
              </div>
              {day.enabled ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <TimeSelect value="9:00 AM" />
                  <span className="text-sm font-medium text-muted-foreground">to</span>
                  <TimeSelect value={day.end} />
                </div>
              ) : (
                <div className="h-11 rounded-[10px] border border-border bg-muted/60 px-4 py-3 text-sm font-medium text-muted-foreground">
                  Unavailable
                </div>
              )}
              <Button variant="ghost" size="icon" aria-label={`Add interval for ${day.label}`}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Copy ${day.label} availability`}>
                <Copy className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 border-t border-border pt-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            <Clock3 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-extrabold text-foreground">Scheduling window</p>
              <p className="text-sm font-medium text-muted-foreground">
                Allow bookings 60 days in advance
              </p>
            </div>
            <Button variant="outline">60 days</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventTypeStep() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-foreground">
        Create first event type
      </h1>
      <p className="mt-2 text-base font-medium text-muted-foreground">
        Define the first meeting people can book.
      </p>
      <div className="mt-8 grid gap-5">
        <div>
          <Label htmlFor="event-title">Title</Label>
          <Input id="event-title" placeholder="30 min intro call" />
        </div>
        <div>
          <Label htmlFor="duration">Duration</Label>
          <Input id="duration" placeholder="30 min" />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="Zoom or Google Meet" />
        </div>
      </div>
    </div>
  );
}

function ShareStep({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-foreground">Share your link</h1>
      <p className="mt-2 text-base font-medium text-muted-foreground">
        You are ready to start accepting bookings.
      </p>
      <div className="mt-8 flex gap-3">
        <Input readOnly value="https://openslot.com/sarah-chen" />
        <Button variant="outline" onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}

function LivePreview({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <aside className="rounded-[16px] border border-border bg-white p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold text-foreground">Live preview</h2>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
          This is how others see you
        </span>
      </div>
      <div className="mb-6">
        <Label htmlFor="booking-link">Your booking link</Label>
        <div className="mt-2 flex gap-3">
          <Input id="booking-link" readOnly value="https://openslot.com/sarah-chen" />
          <Button variant="outline" onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
      <div className="rounded-[14px] border border-border p-5">
        <div className="flex items-center gap-4">
          <AvatarPhoto className="h-16 w-16" />
          <div>
            <p className="text-lg font-extrabold text-foreground">Sarah Chen</p>
            <p className="text-sm font-medium text-muted-foreground">
              Product Designer
            </p>
          </div>
        </div>
        <h3 className="mt-7 text-xl font-extrabold text-foreground">
          Book time with me
        </h3>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Choose a time that works for you. All times are shown in your local time.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <SmallChip icon={<Clock3 className="h-4 w-4" />} label="30 min events" />
          <SmallChip icon={<Video className="h-4 w-4" />} label="Zoom" />
          <SmallChip icon={<CalendarDays className="h-4 w-4" />} label="Weekdays" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
          <MiniCalendar compact className="rounded-[14px] border border-border p-4" />
          <div className="rounded-[14px] border border-border p-4">
            <TimeSlots />
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <PoweredByOpenSlot />
        </div>
      </div>
    </aside>
  );
}

function TimeSelect({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="h-11 rounded-[10px] border border-border bg-white px-4 text-left text-sm font-bold text-foreground shadow-sm"
    >
      {value}
    </button>
  );
}

function SmallChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[8px] border border-border px-3 py-2 text-sm font-bold text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </span>
  );
}
