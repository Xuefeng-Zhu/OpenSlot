"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

type CancelState =
  | "confirm"
  | "cancelling"
  | "cancelled"
  | "already-cancelled"
  | "error";

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
  const [idempotencyKey] = useState(() => createIdempotencyKey());

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
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          cancellationToken,
          cancelReason: cancelReason.trim() || undefined,
          idempotencyKey,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setState("cancelled");
      } else if (result.error?.includes("already been cancelled")) {
        setState("already-cancelled");
      } else {
        setErrorMessage(result.error || "Failed to cancel booking");
        setState("error");
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setState("error");
    }
  }

  if (state === "cancelled" || state === "already-cancelled") {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <CheckCircle
              className="h-6 w-6 text-success"
              aria-hidden="true"
            />
          </div>
          <CardTitle className="text-xl">
            {state === "already-cancelled"
              ? "Booking Already Cancelled"
              : "Booking Cancelled"}
          </CardTitle>
          <CardDescription>
            {state === "already-cancelled"
              ? "This booking was already cancelled."
              : "Your booking has been successfully cancelled."}
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
          {state === "cancelled" && (
            <p className="text-sm text-muted-foreground text-center">
              A cancellation confirmation email has been sent.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <AlertTriangle
            className="h-6 w-6 text-warning"
            aria-hidden="true"
          />
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
          <Label
            htmlFor="cancel-reason"
            className="text-sm font-medium text-muted-foreground"
          >
            Reason for cancellation (optional)
          </Label>
          <Textarea
            id="cancel-reason"
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
            type="button"
            variant="destructive"
            className="flex-1"
            onClick={handleCancel}
            disabled={state === "cancelling"}
          >
            {state === "cancelling" ? "Cancelling..." : "Yes, Cancel Booking"}
          </Button>
          <Button
            type="button"
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

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
