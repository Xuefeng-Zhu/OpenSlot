"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Grid2X2,
  Link2,
  Plus,
  Tag,
} from "lucide-react";

import { AvatarPhoto, LinkIconBadge } from "@/components/brand/booking-preview";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const bookings = [
  {
    name: "Priya Patel",
    event: "Product Strategy Call",
    duration: "30 min",
    day: "Today",
    time: "10:00 AM",
  },
  {
    name: "James Wilson",
    event: "Design Review",
    duration: "45 min",
    day: "Today",
    time: "1:00 PM",
  },
  {
    name: "Emily Johnson",
    event: "Intro Call",
    duration: "15 min",
    day: "Tomorrow",
    time: "9:30 AM",
  },
  {
    name: "Michael Brown",
    event: "Product Strategy Call",
    duration: "30 min",
    day: "Tomorrow",
    time: "11:00 AM",
  },
  {
    name: "Sophie Lee",
    event: "Design Review",
    duration: "45 min",
    day: "Fri, Jun 20",
    time: "2:00 PM",
  },
];

const checklist = [
  { label: "Create an event type", complete: true },
  { label: "Set your availability", complete: true },
  { label: "Share your booking link", complete: true },
  { label: "Add profile details", complete: false },
  { label: "Book a test appointment", complete: false },
];

export default function DashboardPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const bookingLink = "openslot.com/sarah-chen";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${bookingLink}`).then(() => {
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Your booking link has been copied to the clipboard.",
      });
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="mx-auto max-w-[1220px] space-y-7">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">
          Good morning, Sarah
        </h1>
        <p className="mt-1 text-base font-medium text-muted-foreground">
          Here is what is happening with your schedule today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricPanel
          icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
          title="Upcoming bookings"
          value="5"
          description="Next booking in 2 hours"
          action="View bookings"
        />
        <MetricPanel
          icon={<Tag className="h-5 w-5" aria-hidden="true" />}
          title="Active event types"
          value="3"
          description="All systems go"
          action="Manage event types"
        />
        <Card className="bg-white">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-center gap-4">
              <LinkIconBadge />
              <p className="text-sm font-extrabold text-foreground">
                Booking link
              </p>
            </div>
            <p className="mt-7 text-sm font-bold text-primary">{bookingLink}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-fit"
              onClick={handleCopyLink}
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              {copied ? "Copied" : "Copy link"}
            </Button>
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-bold text-primary">
                View booking page
              </span>
              <ExternalLink className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-extrabold text-foreground">
                Availability status
              </p>
            </div>
            <p className="mt-7 text-3xl font-extrabold text-emerald-600">Open</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              You are available to be booked
            </p>
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-bold text-primary">
                Manage availability
              </span>
              <ChevronRight className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card className="bg-white">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-foreground">
                Next bookings
              </h2>
              <Button variant="outline" size="sm">
                View all bookings
              </Button>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-border">
              {bookings.map((booking) => (
                <div
                  key={`${booking.name}-${booking.time}`}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-4 last:border-b-0"
                >
                  <AvatarPhoto className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-foreground">
                      {booking.name}
                    </p>
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {booking.event} - {booking.duration}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-muted-foreground">
                    <p>{booking.day}</p>
                    <p className="text-foreground">{booking.time}</p>
                  </div>
                  <Badge variant="outline" className="border-primary/10 bg-primary/10 text-primary">
                    Upcoming
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-8 text-primary">
              <CalendarDays className="mr-2 h-5 w-5" aria-hidden="true" />
              View full calendar
              <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-white">
            <CardContent className="p-5">
              <h2 className="text-lg font-extrabold text-foreground">
                Setup checklist
              </h2>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-primary/25 text-sm font-extrabold text-primary">
                  75%
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Keep going. You are almost there.
                </p>
              </div>
              <div className="mt-5 overflow-hidden rounded-[14px] border border-border">
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    {item.complete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-border" />
                    )}
                    <span className="text-sm font-medium text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="mt-3 px-0 text-primary">
                Go to settings
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-foreground">
                  Public profile preview
                </h2>
                <Button variant="ghost" size="sm" className="text-primary">
                  View full page
                  <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="rounded-[14px] border border-border p-4">
                <div className="flex gap-4">
                  <AvatarPhoto className="h-16 w-16" />
                  <div>
                    <p className="text-base font-extrabold text-foreground">
                      Sarah Chen
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">
                      Product Designer
                    </p>
                    <p className="mt-2 max-w-[300px] text-sm font-medium leading-6 text-muted-foreground">
                      I help teams design intuitive, impactful product users love.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-muted-foreground">
                      <span>30 min</span>
                      <span>Google Meet</span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full">
                  Preview booking page
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-5 rounded-[18px] border border-primary/10 bg-primary/[0.07] px-8 py-6 sm:flex-row">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-white text-primary shadow-sm">
            <CalendarDays className="h-9 w-9" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-extrabold text-foreground">
              Your schedule. Your way.
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              Add more event types to give people more ways to connect with you.
            </p>
          </div>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New event type
        </Button>
      </div>
    </div>
  );
}

function MetricPanel({
  icon,
  title,
  value,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  action: string;
}) {
  return (
    <Card className="bg-white">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent text-primary">
            {icon}
          </div>
          <p className="text-sm font-extrabold text-foreground">{title}</p>
        </div>
        <p className="mt-7 text-3xl font-extrabold text-foreground">{value}</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {description}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-bold text-primary">{action}</span>
          <ChevronRight className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
