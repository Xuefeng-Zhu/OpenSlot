"use client";

import Link from "next/link";
import {
  Calendar,
  CalendarCheck,
  Activity,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, getInitials } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { getDisplayedBookings } from "@/lib/dashboard-utils";
import { copyTextToClipboard } from "@/lib/utils/clipboard";
import { useCopyFeedback } from "@/components/shared/use-copy-feedback";

export interface DashboardBooking {
  id: string;
  guest_name: string;
  start_at: string;
  end_at: string;
  event_type_title: string;
}

export interface DashboardClientProps {
  profile: {
    username: string;
    name: string;
  };
  upcomingBookings: DashboardBooking[];
  activeEventTypeCount: number;
  bookingLink: string;
}

/**
 * Authenticated dashboard overview for metrics, booking link actions, and the
 * next visible bookings. Server data is rendered once and lightweight clipboard
 * state is kept client-side.
 */
export function DashboardClient({
  profile,
  upcomingBookings,
  activeEventTypeCount,
  bookingLink,
}: DashboardClientProps) {
  const { toast } = useToast();
  const { copied, showCopied } = useCopyFeedback();

  const displayedBookings = getDisplayedBookings(upcomingBookings);

  const handleCopyLink = () => {
    copyTextToClipboard(bookingLink)
      .then(() => {
        showCopied();
        toast({
          title: "Link copied!",
          description: "Your booking link has been copied to clipboard.",
        });
      })
      .catch(() => {
        toast({
          title: "Could not copy link",
          description: "Please copy the URL from your public preview instead.",
          variant: "destructive",
        });
      });
  };

  function formatBookingDate(startAt: string): string {
    const date = new Date(startAt);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatBookingTime(startAt: string): string {
    const date = new Date(startAt);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatDuration(startAt: string, endAt: string): string {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${minutes} min`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile.name.split(" ")[0] || "there"}`}
        description="Track bookings, manage availability, and share your public booking page from one calm workspace."
      />

      {/* Top overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Active event types"
          value={activeEventTypeCount}
          icon={<CalendarCheck className="h-5 w-5" />}
          action={{ label: "Manage event types", href: "/event-types" }}
          subtitle="All systems go"
        />
        <MetricCard
          title="Availability status"
          value="Open"
          valueClassName="text-primary"
          icon={<Activity className="h-5 w-5" />}
          action={{ label: "Manage availability", href: "/availability" }}
          subtitle="You're available to be booked"
        />
        <Card className="h-full">
          <CardContent className="flex h-full flex-col p-5">
            <p className="text-sm font-medium text-muted-foreground">
              Public profile preview
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Avatar
                src={null}
                alt={profile.name}
                fallback={getInitials(profile.name)}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {profile.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  /{profile.username}
                </p>
              </div>
            </div>
            <Button size="sm" className="mt-5 w-full" asChild>
              <Link
                href={`/${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview booking page
                <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Next bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {displayedBookings.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-6 w-6" aria-hidden="true" />}
                heading="No upcoming bookings"
                description="Share your booking link or create a new event type to give guests a clear path to your calendar."
                action={{
                  label: copied ? "Link copied" : "Copy booking link",
                  onClick: handleCopyLink,
                }}
                secondaryAction={{
                  label: "Create event type",
                  onClick: () => {
                    window.location.href = "/event-types/new";
                  },
                }}
                className="border-0 bg-muted/30 py-10"
              />
            ) : (
              <ul className="space-y-1" aria-label="Upcoming bookings">
                {displayedBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <Avatar
                      src={null}
                      alt={booking.guest_name}
                      fallback={getInitials(booking.guest_name)}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {booking.guest_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.event_type_title} ·{" "}
                        {formatDuration(booking.start_at, booking.end_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-foreground">
                        {formatBookingDate(booking.start_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBookingTime(booking.start_at)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-primary border-primary/30 bg-primary/5"
                    >
                      Confirmed
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-primary"
              >
                <Link href="/bookings" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  View all bookings
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
