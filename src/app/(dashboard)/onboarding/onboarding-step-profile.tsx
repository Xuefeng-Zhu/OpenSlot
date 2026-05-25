"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileData, ProfileValidationErrors } from "./onboarding-steps";

export function StepProfile({
  data,
  errors,
  bookingLinkPrefix,
  onChange,
}: {
  data: ProfileData;
  errors: ProfileValidationErrors;
  bookingLinkPrefix: string;
  onChange: (data: ProfileData) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Create your public profile
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This information will be visible on your booking page.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={data.displayName}
            onChange={(event) =>
              onChange({ ...data, displayName: event.target.value })
            }
            placeholder="Sarah Chen"
            aria-invalid={!!errors.displayName}
            aria-describedby={
              errors.displayName ? "displayName-error" : undefined
            }
          />
          {errors.displayName && (
            <p id="displayName-error" className="text-sm text-destructive">
              {errors.displayName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {bookingLinkPrefix}
            </span>
            <Input
              id="username"
              value={data.username}
              onChange={(event) =>
                onChange({ ...data, username: event.target.value })
              }
              placeholder="sarah-chen"
              className="flex-1"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "username-error" : undefined}
            />
          </div>
          {errors.username && (
            <p id="username-error" className="text-sm text-destructive">
              {errors.username}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
