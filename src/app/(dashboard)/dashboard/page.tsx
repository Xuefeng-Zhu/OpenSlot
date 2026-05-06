"use client";

import { useState } from "react";
import {
  Calendar,
  CalendarCheck,
  Link2,
  Activity,
  ExternalLink,
  CheckCircle2,
  Circle,
  Copy,
  User,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getDisplayedBookings } from "@/lib/dashboard-utils";

// Mock data for the dashboard UI shell
const mockBookings = [
  {
    id: "1",
    guestName: "Alice Johnson",
    eventTitle: "30-min Discovery Call",
    date: "Mon, Jan 20",
    time: "10:00 AM – 10:30 AM",
  },
  {
    id: "2",
    guestName: "Bob Smith",
    eventTitle: "60-min Consultation",
    date: "Tue, Jan 21",
    time: "2:00 PM – 3:00 PM",
  },
  {
    id: "3",
    guestName: "Carol Davis",
    eventTitle: "30-min Discovery Call",
    date: "Wed, Jan 22",
    time: "9:00 AM – 9:30 AM",
  },
  {
    id: "4",
    guestName: "Dan Wilson",
    eventTitle: "15-min Quick Chat",
    date: "Thu, Jan 23",
    time: "11:00 AM – 11:15 AM",
  },
  {
    id: "5",
    guestName: "Eve Martinez",
    eventTitle: "60-min Consultation",
    date: "Fri, Jan 24",
    time: "4:00 PM – 5:00 PM",
  },
];

const setupChecklist = [
  { id: "profile", label: "Complete your profile", completed: true },
  { id: "availability", label: "Set your availability", completed: true },
  { id: "event-type", label: "Create an event type", completed: true },
  { id: "first-booking", label: "Get your first booking", completed: false },
];

export default function DashboardPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const bookingLink = "https://openslot.app/johndoe";
  const displayedBookings = getDisplayedBookings(mockBookings);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Your booking link has been copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Upcoming Bookings"
          value={5}
          icon={<Calendar className="h-5 w-5" />}
        />
        <MetricCard
          title="Active Event Types"
          value={3}
          icon={<CalendarCheck className="h-5 w-5" />}
        />
        <MetricCard
          title="Booking Link"
          value="openslot.app/johndoe"
          icon={<Link2 className="h-5 w-5" />}
          action={{ label: copied ? "Copied!" : "Copy", onClick: handleCopyLink }}
        />
        <MetricCard
          title="Availability"
          value="Active"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Next Bookings - takes 2 columns on desktop */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Next Bookings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a href="/bookings">View all</a>
            </Button>
          </CardHeader>
          <CardContent>
            {displayedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No upcoming bookings. Share your booking link to start receiving bookings.
              </p>
            ) : (
              <ul className="space-y-3" aria-label="Upcoming bookings">
                {displayedBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {booking.guestName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {booking.eventTitle}
                      </p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-sm text-foreground">{booking.date}</p>
                      <p className="text-xs text-muted-foreground">{booking.time}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-3 shrink-0"
                      aria-label={`View booking with ${booking.guestName}`}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Setup Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setup Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3" aria-label="Setup checklist">
              {setupChecklist.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  {item.completed ? (
                    <CheckCircle2
                      className="h-5 w-5 text-success shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="h-5 w-5 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`text-sm ${
                      item.completed
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {setupChecklist.filter((i) => i.completed).length} of{" "}
                {setupChecklist.length} completed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public Profile Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Public Profile Preview</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="/johndoe" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" aria-hidden="true" />
              View public page
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <User className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-foreground">John Doe</p>
              <p className="text-sm text-muted-foreground">@johndoe</p>
            </div>
            <Badge variant="success" className="ml-auto">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
