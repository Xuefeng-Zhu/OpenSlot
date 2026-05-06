"use client";

import { useState } from "react";
import {
  Calendar,
  Search,
  X,
  Mail,
  Clock,
  Globe,
  FileText,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerContent,
  DrawerFooter,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/components/ui/use-toast";

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  eventType: string;
  date: string;
  time: string;
  status: "upcoming" | "past" | "cancelled";
  timezone: string;
  notes?: string;
}

const mockBookings: Booking[] = [
  {
    id: "1",
    guestName: "Alice Johnson",
    guestEmail: "alice@example.com",
    eventType: "30-min Discovery Call",
    date: "Mon, Jan 20, 2025",
    time: "10:00 AM – 10:30 AM",
    status: "upcoming",
    timezone: "America/New_York",
    notes: "Looking forward to discussing the project.",
  },
  {
    id: "2",
    guestName: "Bob Smith",
    guestEmail: "bob@example.com",
    eventType: "60-min Consultation",
    date: "Tue, Jan 21, 2025",
    time: "2:00 PM – 3:00 PM",
    status: "upcoming",
    timezone: "America/Chicago",
  },
  {
    id: "3",
    guestName: "Carol Davis",
    guestEmail: "carol@example.com",
    eventType: "30-min Discovery Call",
    date: "Wed, Jan 15, 2025",
    time: "9:00 AM – 9:30 AM",
    status: "past",
    timezone: "America/Los_Angeles",
  },
  {
    id: "4",
    guestName: "Dan Wilson",
    guestEmail: "dan@example.com",
    eventType: "15-min Quick Chat",
    date: "Thu, Jan 10, 2025",
    time: "11:00 AM – 11:15 AM",
    status: "past",
    timezone: "Europe/London",
  },
  {
    id: "5",
    guestName: "Eve Martinez",
    guestEmail: "eve@example.com",
    eventType: "60-min Consultation",
    date: "Fri, Jan 5, 2025",
    time: "4:00 PM – 5:00 PM",
    status: "cancelled",
    timezone: "America/New_York",
    notes: "Had a scheduling conflict.",
  },
];

export default function BookingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");

  const filteredBookings = mockBookings.filter((booking) => {
    if (booking.status !== activeTab) return false;
    if (eventTypeFilter && !booking.eventType.toLowerCase().includes(eventTypeFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  const handleCancelBooking = () => {
    setCancelDialogOpen(false);
    setDrawerOpen(false);
    setCancelReason("");
    toast({
      title: "Booking cancelled",
      description: `The booking with ${selectedBooking?.guestName} has been cancelled.`,
    });
  };

  const renderEmptyState = (tab: string) => {
    const messages: Record<string, { heading: string; description: string }> = {
      upcoming: {
        heading: "No upcoming bookings",
        description: "Share your booking link to start receiving bookings.",
      },
      past: {
        heading: "No past bookings yet",
        description: "Your completed bookings will appear here.",
      },
      cancelled: {
        heading: "No cancelled bookings",
        description: "Cancelled bookings will appear here.",
      },
    };

    return (
      <EmptyState
        icon={<Calendar className="h-6 w-6" />}
        heading={messages[tab].heading}
        description={messages[tab].description}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">
          View and manage all your bookings.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="flex-1">
            <Label htmlFor="date-filter" className="sr-only">
              Date range
            </Label>
            <Input
              id="date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filter by date"
              aria-label="Filter by date"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="event-type-filter" className="sr-only">
              Event type
            </Label>
            <Input
              id="event-type-filter"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              placeholder="Filter by event type..."
              aria-label="Filter by event type"
            />
          </div>
        </div>

        <TabsContent value="upcoming">
          {filteredBookings.length === 0 ? (
            renderEmptyState("upcoming")
          ) : (
            <BookingsTable
              bookings={filteredBookings}
              onBookingClick={handleBookingClick}
            />
          )}
        </TabsContent>

        <TabsContent value="past">
          {filteredBookings.length === 0 ? (
            renderEmptyState("past")
          ) : (
            <BookingsTable
              bookings={filteredBookings}
              onBookingClick={handleBookingClick}
            />
          )}
        </TabsContent>

        <TabsContent value="cancelled">
          {filteredBookings.length === 0 ? (
            renderEmptyState("cancelled")
          ) : (
            <BookingsTable
              bookings={filteredBookings}
              onBookingClick={handleBookingClick}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Booking detail drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Booking Details"
      >
        <DrawerHeader>
          <DrawerTitle>Booking Details</DrawerTitle>
          <DrawerDescription>
            Full details for this booking.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerContent>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <span className="text-sm font-medium">
                    {selectedBooking.guestName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedBooking.guestName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedBooking.guestEmail}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-border p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">{selectedBooking.eventType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">
                    {selectedBooking.date} · {selectedBooking.time}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">{selectedBooking.timezone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">{selectedBooking.guestEmail}</span>
                </div>
                {selectedBooking.notes && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
                    <span className="text-sm">{selectedBooking.notes}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge
                  variant={
                    selectedBooking.status === "upcoming"
                      ? "success"
                      : selectedBooking.status === "cancelled"
                      ? "danger"
                      : "secondary"
                  }
                >
                  {selectedBooking.status.charAt(0).toUpperCase() +
                    selectedBooking.status.slice(1)}
                </Badge>
              </div>
            </div>
          )}
        </DrawerContent>
        <DrawerFooter>
          {selectedBooking?.status === "upcoming" && (
            <Button
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancel booking
            </Button>
          )}
          <Button variant="outline" onClick={() => setDrawerOpen(false)}>
            Close
          </Button>
        </DrawerFooter>
      </Drawer>

      {/* Cancel booking dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking with{" "}
              {selectedBooking?.guestName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Provide a reason for cancellation..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep booking
            </Button>
            <Button variant="destructive" onClick={handleCancelBooking}>
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Desktop table / Mobile card layout
function BookingsTable({
  bookings,
  onBookingClick,
}: {
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
}) {
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
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => onBookingClick(booking)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onBookingClick(booking);
                    }
                  }}
                  aria-label={`View booking with ${booking.guestName}`}
                >
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{booking.guestName}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.guestEmail}
                      </p>
                    </div>
                  </td>
                  <td className="p-3">{booking.eventType}</td>
                  <td className="p-3">
                    <div>
                      <p>{booking.date}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.time}
                      </p>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        booking.status === "upcoming"
                          ? "success"
                          : booking.status === "cancelled"
                          ? "danger"
                          : "secondary"
                      }
                    >
                      {booking.status.charAt(0).toUpperCase() +
                        booking.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card layout - hidden on desktop */}
      <div className="lg:hidden mt-4 space-y-3">
        {bookings.map((booking) => (
          <Card
            key={booking.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onBookingClick(booking)}
            role="button"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onBookingClick(booking);
              }
            }}
            aria-label={`View booking with ${booking.guestName}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{booking.guestName}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {booking.eventType}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {booking.date} · {booking.time}
                  </p>
                </div>
                <Badge
                  variant={
                    booking.status === "upcoming"
                      ? "success"
                      : booking.status === "cancelled"
                      ? "danger"
                      : "secondary"
                  }
                  className="ml-2 shrink-0"
                >
                  {booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
