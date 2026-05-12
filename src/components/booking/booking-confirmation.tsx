"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BookingConfirmationProps {
  bookingId: string;
  cancellationToken: string;
  rescheduleToken?: string;
  startAt: string;
  endAt: string;
  guestName: string;
  eventTitle: string;
  hostName: string;
  timezone: string;
  locationType?: string;
  locationValue?: string | null;
  conferenceProvider?: string | null;
  conferenceStatus?: string;
  conferenceUrl?: string | null;
  variant?: "booking" | "reschedule";
}

export function BookingConfirmation({
  cancellationToken,
  rescheduleToken,
  startAt,
  endAt,
  guestName,
  eventTitle,
  hostName,
  timezone,
  locationType,
  locationValue,
  conferenceProvider,
  conferenceStatus,
  conferenceUrl,
  variant = "booking",
}: BookingConfirmationProps) {
  function formatDateTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timezone || undefined,
    });
  }

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  }

  const cancellationUrl = `/booking/cancel/${cancellationToken}`;
  const rescheduleUrl = rescheduleToken
    ? `/booking/reschedule/${rescheduleToken}`
    : null;
  const isReschedule = variant === "reschedule";
  const locationLabel = bookingLocationLabel({
    locationType,
    locationValue,
    conferenceProvider,
  });
  const conferenceMessage = conferenceStatusMessage(
    conferenceStatus,
    conferenceProvider
  );

  return (
    <Card className="mt-6 max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <CardTitle className="text-xl">
          {isReschedule ? "Booking Rescheduled!" : "Booking Confirmed!"}
        </CardTitle>
        <CardDescription>
          {isReschedule
            ? "Your meeting has been moved successfully."
            : "Your meeting has been scheduled successfully."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking details */}
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Event</span>
            <span className="font-medium">{eventTitle}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Host</span>
            <span className="font-medium">{hostName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Guest</span>
            <span className="font-medium">{guestName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date</span>
            <span className="font-medium">{formatDateTime(startAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Time</span>
            <span className="font-medium">
              {formatTime(startAt)} – {formatTime(endAt)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Timezone</span>
            <Badge variant="secondary">{timezone.replace(/_/g, " ")}</Badge>
          </div>
          {locationLabel && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Location</span>
              <span className="text-right font-medium">{locationLabel}</span>
            </div>
          )}
          {conferenceUrl && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Join link</span>
              <a
                href={conferenceUrl}
                className="text-right text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open meeting
              </a>
            </div>
          )}
          {!conferenceUrl && conferenceMessage && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {conferenceMessage}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="default">Confirmed</Badge>
          </div>
        </div>

        {/* Info text */}
        <p className="text-sm text-muted-foreground text-center">
          A confirmation email has been sent with the booking details.
        </p>

        <div className="flex justify-center gap-2 pt-2">
          {rescheduleUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={rescheduleUrl}>Need to reschedule?</a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={cancellationUrl}>Need to cancel?</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function bookingLocationLabel({
  locationType,
  locationValue,
  conferenceProvider,
}: {
  locationType?: string;
  locationValue?: string | null;
  conferenceProvider?: string | null;
}) {
  if (conferenceProvider === "google_meet") return "Google Meet";
  if (conferenceProvider === "microsoft_teams") return "Microsoft Teams";
  if (locationValue) return locationValue;
  if (locationType === "phone") return "Phone call";
  if (locationType === "in_person") return "In person";
  if (locationType === "online") return "Online";
  return null;
}

function conferenceStatusMessage(
  conferenceStatus?: string,
  conferenceProvider?: string | null
) {
  if (!conferenceProvider || conferenceStatus === "ready") return null;

  if (conferenceStatus === "setup_required") {
    return "The host needs to finish video setup before a meeting link can be generated.";
  }

  if (conferenceStatus === "failed") {
    return "The meeting link could not be generated yet. The host can retry from their integration setup.";
  }

  return "The video meeting link is being generated and will be sent by email when it is ready.";
}
