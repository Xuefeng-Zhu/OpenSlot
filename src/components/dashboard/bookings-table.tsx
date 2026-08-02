"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Booking, BookingCategory } from "@/lib/booking-utils";
import { useDashboardDisplayPreferences } from "@/components/dashboard/display-preferences-provider";
import {
  formatBookingDateTime,
  getBookingStatusLabel,
} from "@/components/dashboard/bookings-format";

interface BookingsTableProps {
  bookings: Booking[];
  category: BookingCategory;
  onBookingClick: (booking: Booking) => void;
}

// Desktop table / Mobile card layout
export function BookingsTable({
  bookings,
  category,
  onBookingClick,
}: BookingsTableProps) {
  const displayPreferences = useDashboardDisplayPreferences();

  return (
    <>
      {/* Desktop table - hidden on mobile */}
      <div className="hidden lg:block mt-4">
        <div className="rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">
                  Guest
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  Event type
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  Date/time
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const { date, time: startTime } = formatBookingDateTime(
                  booking.start_at,
                  displayPreferences
                );
                const { time: endTime } = formatBookingDateTime(
                  booking.end_at,
                  displayPreferences
                );
                return (
                  <tr
                    key={booking.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{booking.guest_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.guest_email}
                        </p>
                      </div>
                    </td>
                    <td className="p-3">{booking.event_type_title}</td>
                    <td className="p-3">
                      <div>
                        <p>{date}</p>
                        <p className="text-xs text-muted-foreground">
                          {startTime} – {endTime}
                        </p>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={statusBadgeVariant(category)}>
                        {getBookingStatusLabel(category)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onBookingClick(booking)}
                        aria-label={`View booking with ${booking.guest_name}`}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card layout - hidden on desktop */}
      <div className="lg:hidden mt-4 space-y-3">
        {bookings.map((booking) => {
          const { date, time: startTime } = formatBookingDateTime(
            booking.start_at,
            displayPreferences
          );
          const { time: endTime } = formatBookingDateTime(
            booking.end_at,
            displayPreferences
          );
          return (
            <button
              key={booking.id}
              type="button"
              className="block w-full rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => onBookingClick(booking)}
              aria-label={`View booking with ${booking.guest_name}`}
            >
              <span className="flex items-start justify-between">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {booking.guest_name}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {booking.event_type_title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {date} · {startTime} – {endTime}
                  </span>
                </span>
                <span
                  className={`ml-2 inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${mobileStatusBadgeClass(
                    category
                  )}`}
                >
                  {getBookingStatusLabel(category)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function statusBadgeVariant(category: BookingCategory): "success" | "danger" | "secondary" {
  if (category === "upcoming") return "success";
  if (category === "cancelled") return "danger";
  return "secondary";
}

function mobileStatusBadgeClass(category: BookingCategory) {
  if (category === "upcoming") return "border-transparent bg-success text-success-foreground";
  if (category === "cancelled") return "border-transparent bg-destructive text-destructive-foreground";
  return "border-transparent bg-muted text-muted-foreground";
}
