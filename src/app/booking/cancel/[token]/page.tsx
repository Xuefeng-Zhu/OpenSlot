"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Clock,
  Globe,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type PageState = "active" | "cancelled" | "already-cancelled" | "invalid";

// Mock data for the UI shell
const mockBooking = {
  eventTitle: "30-min Discovery Call",
  hostName: "John Doe",
  date: "Monday, January 20, 2025",
  time: "10:00 AM – 10:30 AM",
  timezone: "America/New_York",
  cancelledAt: "January 15, 2025",
};

export default function CancelBookingPage() {
  // For the UI shell, we show the active state by default
  const [pageState, setPageState] = useState<PageState>("active");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setPageState("cancelled");
  };

  // Error state - invalid/expired token
  if (pageState === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Invalid Cancellation Link
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This cancellation link is no longer valid. It may have expired or
              already been used.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already cancelled state
  if (pageState === "already-cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <AlertCircle
                className="h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Already Cancelled
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This booking was already cancelled on {mockBooking.cancelledAt}.
            </p>
            <div className="mt-4 rounded-md border border-border p-4 text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium">{mockBooking.eventTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Host</span>
                  <span className="font-medium">{mockBooking.hostName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="danger">Cancelled</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state - just cancelled
  if (pageState === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle
                className="h-6 w-6 text-success"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Booking Cancelled
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your booking has been successfully cancelled. The host has been
              notified.
            </p>
            <div className="mt-4 rounded-md border border-border p-4 text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium">{mockBooking.eventTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Host</span>
                  <span className="font-medium">{mockBooking.hostName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{mockBooking.date}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active state - show cancellation form
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Cancel Booking</CardTitle>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel this booking?
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Booking details */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">
                {mockBooking.eventTitle}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm">{mockBooking.hostName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm">
                {mockBooking.date} · {mockBooking.time}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm">{mockBooking.timezone}</span>
            </div>
          </div>

          {/* Reason textarea */}
          <div>
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let the host know why you're cancelling..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Action button */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Cancelling..." : "Cancel booking"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
