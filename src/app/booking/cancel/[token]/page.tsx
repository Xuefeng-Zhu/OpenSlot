import { createAdminClient } from "@/lib/supabase/admin";
import { CancelBookingForm } from "@/components/booking/cancel-booking-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CancelBookingPageProps {
  params: Promise<{ token: string }>;
}

export default async function CancelBookingPage({
  params,
}: CancelBookingPageProps) {
  const { token } = await params;

  // Use admin client to bypass RLS — lookup by cancellation_token
  const adminClient = createAdminClient();

  const { data: booking, error } = await adminClient
    .from("bookings")
    .select("*")
    .eq("cancellation_token", token)
    .single();

  // Invalid token — no booking found
  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <CardTitle className="text-xl">Invalid Cancellation Link</CardTitle>
            <CardDescription>
              This cancellation link is invalid or has expired. Please check the
              link in your confirmation email and try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Already cancelled
  if (booking.status === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-6 w-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <CardTitle className="text-xl">Already Cancelled</CardTitle>
            <CardDescription>
              This booking has already been cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Guest</span>
                <span className="font-medium">{booking.guest_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="destructive">Cancelled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch event type and host profile for display
  const [eventTypeResult, hostProfileResult] = await Promise.all([
    adminClient
      .from("event_types")
      .select("title")
      .eq("id", booking.event_type_id)
      .single(),
    adminClient
      .from("profiles")
      .select("name")
      .eq("id", booking.host_user_id)
      .single(),
  ]);

  const eventTitle = eventTypeResult.data?.title ?? "Meeting";
  const hostName = hostProfileResult.data?.name ?? "Host";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <CancelBookingForm
        bookingId={booking.id}
        cancellationToken={token}
        eventTitle={eventTitle}
        hostName={hostName}
        guestName={booking.guest_name}
        startAt={booking.start_at}
        endAt={booking.end_at}
        guestTimezone={booking.guest_timezone}
      />
    </div>
  );
}
