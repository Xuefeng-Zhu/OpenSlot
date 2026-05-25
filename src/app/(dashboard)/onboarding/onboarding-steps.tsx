"use client";

import { Calendar, Check, FileText, Link2, User } from "lucide-react";
import type { TimeInterval } from "@/components/dashboard/availability-day-row";
import type { VideoProvider } from "@/lib/calendar/video-providers";
import { cn } from "@/lib/utils";
import type { EventLocationType } from "@/lib/validations/event-type";

export { StepAvailability } from "./onboarding-step-availability";
export { StepBookingLink } from "./onboarding-step-booking-link";
export { StepEventType } from "./onboarding-step-event-type";
export { StepProfile } from "./onboarding-step-profile";

export const ONBOARDING_STEPS = [
  { label: "Create public profile", icon: User },
  { label: "Set availability", icon: Calendar },
  { label: "Create first event type", icon: FileText },
  { label: "Share booking link", icon: Link2 },
] as const;

export interface ProfileData {
  displayName: string;
  username: string;
}

export interface DayAvailability {
  enabled: boolean;
  intervals: TimeInterval[];
}

export interface AvailabilityData {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export interface EventTypeData {
  title: string;
  duration: string;
  locationType: EventLocationType;
  locationValue: string;
  videoProvider: VideoProvider | null;
}

export interface ProfileValidationErrors {
  displayName?: string;
  username?: string;
}

export interface AvailabilityValidationErrors {
  general?: string;
  days: Partial<Record<keyof AvailabilityData, string>>;
}

export interface EventTypeValidationErrors {
  title?: string;
  locationType?: string;
  locationValue?: string;
  videoProvider?: string;
}

export function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Onboarding progress">
      <ol className="hidden md:flex items-center justify-between">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const Icon = step.icon;
          return (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isActive && "border-primary bg-accent text-primary",
                    !isCompleted &&
                      !isActive &&
                      "border-border bg-background text-muted-foreground"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs text-center max-w-[100px]",
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < ONBOARDING_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 self-start mt-5",
                    index < currentStep ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Step {currentStep + 1} of {ONBOARDING_STEPS.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {ONBOARDING_STEPS[currentStep].label}
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS.length}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
