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
  startAt: string;
  endAt: string;
  guestName: string;
  eventTitle: string;
  hostName: string;
  timezone: string;
}

export function BookingConfirmation({
  cancellationToken,
  startAt,
  endAt,
  guestName,
  eventTitle,
  hostName,
  timezone,
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
        <CardTitle className="text-xl">Booking Confirmed!</CardTitle>
        <CardDescription>
          Your meeting has been scheduled successfully.
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="default">Confirmed</Badge>
          </div>
        </div>

        {/* Info text */}
        <p className="text-sm text-muted-foreground text-center">
          A confirmation email has been sent with the booking details.
        </p>

        {/* Cancellation link */}
        <div className="pt-2 text-center">
          <Button variant="outline" size="sm" asChild>
            <a href={cancellationUrl}>Need to cancel?</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
