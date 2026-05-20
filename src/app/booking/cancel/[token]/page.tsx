import { AlertCircle, Calendar, Clock, User, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CancelBookingForm } from "@/components/booking/cancel-booking-form";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCancellationDetails,
  isValidCancellationToken,
  type CancellationBookingDetails,
} from "@/lib/booking/cancellation-details";

export const runtime = "edge";

interface CancelBookingPageProps {
  params: Promise<{ token: string }>;
}

export default async function CancelBookingPage({
  params,
}: CancelBookingPageProps) {
  const { token } = await params;

  if (!isValidCancellationToken(token)) {
    return (
      <CancellationStatusCard
        title="Invalid Cancellation Link"
        description="This cancellation link is no longer valid. It may have expired or already been used."
      />
    );
  }

  const result = await getCancellationDetails(token, createAdminClient());

  if (result.status === "invalid") {
    return (
      <CancellationStatusCard
        title="Invalid Cancellation Link"
        description="This cancellation link is no longer valid. It may have expired or already been used."
      />
    );
  }

  if (result.status === "already-cancelled") {
    return <AlreadyCancelledCard booking={result.booking} />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <CancelBookingForm
        bookingId={result.booking.bookingId}
        cancellationToken={result.booking.cancellationToken}
        eventTitle={result.booking.eventTitle}
        hostName={result.booking.hostName}
        guestName={result.booking.guestName}
        startAt={result.booking.startAt}
        endAt={result.booking.endAt}
        guestTimezone={result.booking.guestTimezone}
      />
    </main>
  );
}

function AlreadyCancelledCard({
  booking,
}: {
  booking: CancellationBookingDetails;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
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
            This booking has already been cancelled.
          </p>
          <BookingDetailsSummary
            booking={booking}
            status="Cancelled"
            statusVariant="danger"
            className="mt-4"
          />
        </CardContent>
      </Card>
    </main>
  );
}

function CancellationStatusCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </main>
  );
}

function BookingDetailsSummary({
  booking,
  status,
  statusVariant,
  className,
}: {
  booking: CancellationBookingDetails;
  status: string;
  statusVariant: "default" | "danger";
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-left">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="font-medium">{booking.eventTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <User
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span>{booking.hostName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              {formatBookingDate(booking.startAt, booking.guestTimezone)} at{" "}
              {formatBookingTime(booking.startAt, booking.guestTimezone)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={statusVariant}>{status}</Badge>
          </div>
          {booking.cancelledAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cancelled</span>
              <span className="font-medium">
                {formatBookingDate(booking.cancelledAt, booking.guestTimezone)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBookingDate(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone || undefined,
  });
}

function formatBookingTime(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });
}
