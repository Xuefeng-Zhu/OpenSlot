"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarCheck,
  Link2,
  CheckCircle2,
  Activity,
  ExternalLink,
  Circle,
  Copy,
  User,
  Clock,
  MapPin,
  ArrowRight,
  Plus,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, getInitials } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { getDisplayedBookings } from "@/lib/dashboard-utils";

// Mock data for the dashboard UI shell
const mockBookings = [
  {
    id: "1",
    guestName: "Priya Patel",
    eventTitle: "Product Strategy Call",
    date: "Today",
    time: "10:00 AM",
    duration: "30 min",
    status: "Upcoming",
  },
  {
    id: "2",
    guestName: "James Wilson",
    eventTitle: "Design Review",
    date: "Today",
    time: "1:00 PM",
    duration: "45 min",
    status: "Upcoming",
  },
  {
    id: "3",
    guestName: "Emily Johnson",
    eventTitle: "Intro Call",
    date: "Tomorrow",
    time: "9:30 AM",
    duration: "15 min",
    status: "Upcoming",
  },
  {
    id: "4",
    guestName: "Michael Brown",
    eventTitle: "Product Strategy Call",
    date: "Tomorrow",
    time: "11:00 AM",
    duration: "30 min",
    status: "Upcoming",
  },
  {
    id: "5",
    guestName: "Sophie Lee",
    eventTitle: "Design Review",
    date: "Fri, Jun 20",
    time: "2:00 PM",
    duration: "45 min",
    status: "Upcoming",
  },
];

const setupChecklist = [
  { id: "event-type", label: "Create an event type", completed: true },
  { id: "availability", label: "Set your availability", completed: true },
  { id: "share-link", label: "Share your booking link", completed: true },
  { id: "profile", label: "Add profile details", completed: false },
  { id: "test-booking", label: "Book a test appointment", completed: false },
];

export default function DashboardPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const bookingLink = "openslot.com/sarah-chen";
  const displayedBookings = getDisplayedBookings(mockBookings);
  const completedCount = setupChecklist.filter((i) => i.completed).length;
  const completionPercent = Math.round((completedCount / setupChecklist.length) * 100);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${bookingLink}`).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Your booking link has been copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Good morning, Sarah 👋</h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your schedule today.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Upcoming bookings"
          value={5}
          icon={<Calendar className="h-5 w-5" />}
          action={{ label: "View bookings", onClick: () => {} }}
          subtitle="Next booking in 2 hours"
        />
        <MetricCard
          title="Active event types"
          value={3}
          icon={<CalendarCheck className="h-5 w-5" />}
          action={{ label: "Manage event types", onClick: () => {} }}
          subtitle="All systems go"
        />
        <MetricCard
          title="Booking link"
          value={bookingLink}
          icon={<Link2 className="h-5 w-5" />}
          action={{ label: copied ? "Copied!" : "Copy link", onClick: handleCopyLink }}
        />
        <MetricCard
          title="Availability status"
          value="Open"
          valueClassName="text-primary"
          icon={<Activity className="h-5 w-5" />}
          action={{ label: "Manage availability", onClick: () => {} }}
          subtitle="You're available to be booked"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Next Bookings - takes 2 columns on desktop */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Next bookings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bookings" className="flex items-center gap-1 text-primary">
                View all bookings
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {displayedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No upcoming bookings. Share your booking link to start receiving bookings.
              </p>
            ) : (
              <ul className="space-y-1" aria-label="Upcoming bookings">
                {displayedBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <Avatar
                      src={null}
                      alt={booking.guestName}
                      fallback={getInitials(booking.guestName)}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {booking.guestName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.eventTitle} · {booking.duration}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-foreground">{booking.date}</p>
                      <p className="text-xs text-muted-foreground">{booking.time}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-primary border-primary/30 bg-primary/5">
                      {booking.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" asChild className="text-primary">
                <Link href="/bookings" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  View full calendar
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Setup Checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Setup checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-sm font-bold text-primary">{completionPercent}%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Keep going! You&apos;re almost there.
                </p>
              </div>
              <ul className="space-y-2.5" aria-label="Setup checklist">
                {setupChecklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5">
                    {item.completed ? (
                      <CheckCircle2
                        className="h-4.5 w-4.5 text-success shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className="h-4.5 w-4.5 text-muted-foreground/40 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`text-sm ${
                        item.completed
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Button variant="ghost" size="sm" asChild className="text-primary p-0">
                  <Link href="/settings" className="flex items-center gap-1">
                    Go to settings
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Public Profile Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Public profile preview</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-primary">
                <Link href="/johndoe">
                  View full page
                  <ArrowRight className="h-3 w-3 ml-1" aria-hidden="true" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar
                  src={null}
                  alt="Sarah Chen"
                  fallback="SC"
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Sarah Chen</p>
                  <p className="text-sm text-muted-foreground">Product Designer</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    I help teams design intuitive, impactful products users love.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  30 min
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  Google Meet
                </span>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/johndoe" target="_blank" rel="noopener noreferrer">
                    Preview booking page
                    <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom CTA bar */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-foreground">Your schedule. Your way.</p>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Add more event types to give people more ways to connect with you.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/event-types/new">
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            New event type
          </Link>
        </Button>
      </div>
    </div>
  );
}
