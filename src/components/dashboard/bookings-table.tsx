"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Booking, BookingCategory } from "@/lib/booking-utils";
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
                  booking.start_at
                );
                const { time: endTime } = formatBookingDateTime(booking.end_at);
                return (
                  <tr
                    key={booking.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 focus:outline-none focus-visible:bg-accent/70"
                    onClick={() => onBookingClick(booking)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onBookingClick(booking);
                      }
                    }}
                    aria-label={`View booking with ${booking.guest_name}`}
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
                      <Badge
                        variant={
                          category === "upcoming"
                            ? "success"
                            : category === "cancelled"
                              ? "danger"
                              : "secondary"
                        }
                      >
                        {getBookingStatusLabel(category)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm">
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
            booking.start_at
          );
          const { time: endTime } = formatBookingDateTime(booking.end_at);
          return (
            <Card
              key={booking.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => onBookingClick(booking)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onBookingClick(booking);
                }
              }}
              aria-label={`View booking with ${booking.guest_name}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{booking.guest_name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {booking.event_type_title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {date} · {startTime} – {endTime}
                    </p>
                  </div>
                  <Badge
                    variant={
                      category === "upcoming"
                        ? "success"
                        : category === "cancelled"
                          ? "danger"
                          : "secondary"
                    }
                    className="ml-2 shrink-0"
                  >
                    {getBookingStatusLabel(category)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
