"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  MoreHorizontal,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";

import { AvatarPhoto } from "@/components/brand/booking-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  eventType: string;
  duration: string;
  date: string;
  weekday: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled";
  notes?: string;
}

const bookings: Booking[] = [
  {
    id: "1",
    guestName: "Emily Johnson",
    guestEmail: "emily.j@example.com",
    eventType: "Product Demo",
    duration: "30 min",
    date: "Jun 16, 2025",
    weekday: "Mon",
    time: "9:00 AM",
    status: "confirmed",
    notes: "Interested in team plan for a group of 10 users. Follow up with pricing and onboarding details.",
  },
  {
    id: "2",
    guestName: "Michael Brown",
    guestEmail: "michael.b@example.com",
    eventType: "Discovery Call",
    duration: "45 min",
    date: "Jun 16, 2025",
    weekday: "Mon",
    time: "11:00 AM",
    status: "confirmed",
  },
  {
    id: "3",
    guestName: "Sophia Davis",
    guestEmail: "sophia.d@example.com",
    eventType: "Onboarding Call",
    duration: "60 min",
    date: "Jun 16, 2025",
    weekday: "Mon",
    time: "2:00 PM",
    status: "confirmed",
  },
  {
    id: "4",
    guestName: "Daniel Wilson",
    guestEmail: "daniel.w@example.com",
    eventType: "Product Demo",
    duration: "30 min",
    date: "Jun 17, 2025",
    weekday: "Tue",
    time: "10:00 AM",
    status: "pending",
  },
  {
    id: "5",
    guestName: "Olivia Martinez",
    guestEmail: "olivia.m@example.com",
    eventType: "Discovery Call",
    duration: "45 min",
    date: "Jun 17, 2025",
    weekday: "Tue",
    time: "1:00 PM",
    status: "confirmed",
  },
  {
    id: "6",
    guestName: "James Anderson",
    guestEmail: "james.a@example.com",
    eventType: "Onboarding Call",
    duration: "60 min",
    date: "Jun 18, 2025",
    weekday: "Wed",
    time: "9:00 AM",
    status: "confirmed",
  },
  {
    id: "7",
    guestName: "Isabella Thomas",
    guestEmail: "isabella.t@example.com",
    eventType: "Product Demo",
    duration: "30 min",
    date: "Jun 18, 2025",
    weekday: "Wed",
    time: "3:00 PM",
    status: "cancelled",
  },
  {
    id: "8",
    guestName: "Ethan Lee",
    guestEmail: "ethan.lee@example.com",
    eventType: "Discovery Call",
    duration: "45 min",
    date: "Jun 19, 2025",
    weekday: "Thu",
    time: "11:00 AM",
    status: "confirmed",
  },
];

export default function BookingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [selectedBooking, setSelectedBooking] = useState(bookings[0]);

  const handleCancelBooking = () => {
    toast({
      title: "Booking cancelled",
      description: `The booking with ${selectedBooking.guestName} has been cancelled.`,
    });
  };

  return (
    <div className="mx-auto grid max-w-[1220px] gap-6 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">Bookings</h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            View and manage your bookings.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <FilterSelect label="Event type" value="All event types" />
          <FilterSelect label="Date range" value="Jun 1 - Jun 30, 2025" />
          <FilterSelect label="Status" value="All statuses" />
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
            Filters
          </Button>
        </div>

        <Card className="overflow-hidden bg-white">
          <CardContent className="p-0">
            <div className="hidden grid-cols-[1.5fr_1fr_0.7fr_0.7fr_0.7fr_auto] border-b border-border px-4 py-3 text-xs font-extrabold text-muted-foreground lg:grid">
              <span>Guest</span>
              <span>Event</span>
              <span>Date</span>
              <span>Time</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            {bookings.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => setSelectedBooking(booking)}
                className={`grid w-full gap-4 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 lg:grid-cols-[1.5fr_1fr_0.7fr_0.7fr_0.7fr_auto] lg:items-center ${
                  booking.id === selectedBooking.id
                    ? "bg-primary/5 ring-1 ring-inset ring-primary/25"
                    : "hover:bg-muted/40"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarPhoto className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-foreground">
                      {booking.guestName}
                    </p>
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {booking.guestEmail}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{booking.eventType}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {booking.duration}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{booking.date}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {booking.weekday}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{booking.time}</p>
                  <p className="text-xs font-medium text-muted-foreground">EDT</p>
                </div>
                <StatusBadge status={booking.status} />
                <Button variant="outline" size="icon" aria-label={`More actions for ${booking.guestName}`}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col justify-between gap-4 text-sm font-medium text-muted-foreground sm:flex-row sm:items-center">
          <p>1-8 of 24 bookings</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" className="border-primary text-primary">
              1
            </Button>
            <Button variant="ghost" size="icon">2</Button>
            <Button variant="ghost" size="icon">3</Button>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" className="ml-4">
              10 per page
              <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <aside className="rounded-[16px] border border-border bg-white shadow-md xl:sticky xl:top-24 xl:h-fit">
        <div className="flex justify-end p-4">
          <Button variant="ghost" size="icon" aria-label="Close booking details">
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="px-7 pb-7">
          <AvatarPhoto className="h-16 w-16" />
          <h2 className="mt-4 text-xl font-extrabold text-foreground">
            {selectedBooking.guestName}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Mail className="h-4 w-4" aria-hidden="true" />
            {selectedBooking.guestEmail}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StatusBadge status={selectedBooking.status} />
            <span className="text-xs font-medium text-muted-foreground">
              Booked on Jun 10, 2025 at 4:32 PM
            </span>
          </div>

          <DetailSection title="Event details">
            <div className="flex gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                <CalendarDays className="h-9 w-9" aria-hidden="true" />
              </div>
              <div>
                <p className="font-extrabold text-foreground">
                  {selectedBooking.eventType}
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                  See how OpenSlot can help streamline your scheduling.
                </p>
              </div>
            </div>
            <DetailItem icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} label="Date" value={`Monday, ${selectedBooking.date}`} />
            <DetailItem icon={<Clock3 className="h-4 w-4" aria-hidden="true" />} label="Time" value={`${selectedBooking.time} - 9:30 AM`} />
            <DetailItem icon={<Clock3 className="h-4 w-4" aria-hidden="true" />} label="Timezone" value="Eastern Time (EDT)" />
            <DetailItem icon={<Clock3 className="h-4 w-4" aria-hidden="true" />} label="Duration" value={selectedBooking.duration} />
            <DetailItem
              icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
              label="Location"
              value={
                <span>
                  Google Meet
                  <a href="#" className="ml-2 text-primary underline">
                    Join meeting
                    <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden="true" />
                  </a>
                </span>
              }
            />
          </DetailSection>

          <DetailSection title="Notes">
            <p className="text-sm font-medium leading-6 text-muted-foreground">
              {selectedBooking.notes || "No notes were added for this booking."}
            </p>
          </DetailSection>

          <DetailSection title="Booking actions">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[14px] p-3 text-left hover:bg-muted"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-foreground">
                    Reschedule booking
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Choose a new time that works better.
                  </span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleCancelBooking}
              className="mt-3 flex w-full items-center gap-3 rounded-[14px] border border-destructive/40 bg-destructive/5 p-3 text-left text-destructive"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-extrabold">Cancel booking</span>
                <span className="text-xs font-medium">
                  This will cancel the booking and notify the guest.
                </span>
              </span>
            </button>
          </DetailSection>
        </div>
      </aside>
    </div>
  );
}

function FilterSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-foreground">{value}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  if (status === "pending") {
    return <Badge variant="warning">Pending</Badge>;
  }

  if (status === "cancelled") {
    return <Badge variant="danger">Cancelled</Badge>;
  }

  return <Badge variant="success">Confirmed</Badge>;
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 border-t border-border pt-7">
      <h3 className="mb-5 text-sm font-extrabold text-foreground">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-4 text-sm">
      <p className="flex items-center gap-2 font-bold text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="font-medium text-muted-foreground">{value}</div>
    </div>
  );
}
