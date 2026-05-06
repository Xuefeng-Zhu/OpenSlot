"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CancelBookingFormProps {
  bookingId: string;
  cancellationToken: string;
  eventTitle: string;
  hostName: string;
  guestName: string;
  startAt: string;
  endAt: string;
  guestTimezone: string;
}

type CancelState = "confirm" | "cancelling" | "cancelled" | "error";

export function CancelBookingForm({
  bookingId,
  cancellationToken,
  eventTitle,
  hostName,
  guestName,
  startAt,
  endAt,
  guestTimezone,
}: CancelBookingFormProps) {
  const [state, setState] = useState<CancelState>("confirm");
  const [cancelReason, setCancelReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function formatDateTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: guestTimezone || undefined,
    });
  }

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: guestTimezone || undefined,
    });
  }

  async function handleCancel() {
    setState("cancelling");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationToken,
          cancelReason: cancelReason.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setState("cancelled");
      } else {
        setErrorMessage(result.error || "Failed to cancel booking");
        setState("error");
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setState("error");
    }
  }

  if (state === "cancelled") {
    return (
      <Card className="max-w-lg mx-auto">
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
          <CardTitle className="text-xl">Booking Cancelled</CardTitle>
          <CardDescription>
            Your booking has been successfully cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Event</span>
              <span className="font-medium">{eventTitle}</span>
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
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="danger">Cancelled</Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            A cancellation confirmation email has been sent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-6 w-6 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <CardTitle className="text-xl">Cancel Booking</CardTitle>
        <CardDescription>
          Are you sure you want to cancel this booking?
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
            <Badge variant="secondary">
              {guestTimezone.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>

        {/* Cancel reason textarea */}
        <div className="space-y-2">
          <label
            htmlFor="cancel-reason"
            className="text-sm font-medium text-muted-foreground"
          >
            Reason for cancellation (optional)
          </label>
          <textarea
            id="cancel-reason"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Let the host know why you're cancelling..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            maxLength={500}
            disabled={state === "cancelling"}
          />
        </div>

        {/* Error message */}
        {state === "error" && errorMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleCancel}
            disabled={state === "cancelling"}
          >
            {state === "cancelling" ? "Cancelling..." : "Yes, Cancel Booking"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.history.back()}
            disabled={state === "cancelling"}
          >
            Go Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
