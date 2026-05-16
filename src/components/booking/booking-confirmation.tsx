"use client";

import { CalendarCheck, CheckCircle2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { videoProviderLabel } from "@/lib/calendar/video-providers";

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
    <Card className="mx-auto mt-6 max-w-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">
          {isReschedule ? "Booking rescheduled" : "Booking confirmed"}
        </CardTitle>
        <CardDescription>
          {isReschedule
            ? "Your meeting has been moved successfully."
            : "Your meeting has been scheduled successfully."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking details */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Event</span>
            <span className="text-right font-medium">{eventTitle}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Host</span>
            <span className="text-right font-medium">{hostName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Guest</span>
            <span className="text-right font-medium">{guestName}</span>
          </div>
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CalendarCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Date
                </p>
                <p className="font-medium">{formatDateTime(startAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Time
                </p>
                <p className="font-medium">
                  {formatTime(startAt)} - {formatTime(endAt)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
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
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="default">Confirmed</Badge>
          </div>
        </div>

        {/* Info text */}
        <p className="text-sm text-muted-foreground text-center">
          A confirmation email has been sent with the booking details.
        </p>

        <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
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
  const generatedVideoLabel = videoProviderLabel(conferenceProvider);
  if (generatedVideoLabel) return generatedVideoLabel;
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
