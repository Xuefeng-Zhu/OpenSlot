"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  Mail,
  Clock,
  Globe,
  FileText,
  X,
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
import {
  type Booking,
  type BookingCategory,
  categorizeBookings,
  filterBookingsByEventType,
} from "@/lib/booking-utils";

interface BookingsClientProps {
  bookings: Booking[];
}

function getStatusLabel(category: BookingCategory): string {
  if (category === "upcoming") return "Confirmed";
  if (category === "cancelled") return "Cancelled";
  return "Completed";
}

function formatDateTime(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { date, time };
}

/**
 * Dashboard booking manager with local categorization, filtering, detail drawer,
 * and guest-token cancellation. Local state is updated after cancellation so the
 * dashboard reflects the change before the next server refresh.
 */
export default function BookingsClient({ bookings: initialBookings }: BookingsClientProps) {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [activeTab, setActiveTab] = useState<BookingCategory>("upcoming");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("");

  const categorized = useMemo(() => categorizeBookings(bookings), [bookings]);

  const eventTypeOptions = useMemo(() => {
    const titles = bookings
      .map((booking) => booking.event_type_title)
      .filter(Boolean);

    return Array.from(new Set(titles)).sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const categoryBookings = categorized[activeTab];
    return filterBookingsByEventType(categoryBookings, eventTypeFilter);
  }, [categorized, activeTab, eventTypeFilter]);

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    setCancelling(true);
    try {
      const response = await fetch(`/api/bookings/${selectedBooking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationToken: selectedBooking.cancellation_token,
          cancelReason: cancelReason || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel booking");
      }

      // Update local state: change the booking's status to cancelled
      setBookings((prev) =>
        prev.map((b) =>
          b.id === selectedBooking.id ? { ...b, status: "cancelled" } : b
        )
      );

      setCancelDialogOpen(false);
      setDrawerOpen(false);
      setCancelReason("");

      toast({
        title: "Booking cancelled",
        description: `The booking with ${selectedBooking.guest_name} has been cancelled.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel booking",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const renderEmptyState = (tab: BookingCategory) => {
    const messages: Record<BookingCategory, { heading: string; description: string }> = {
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BookingCategory)}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="w-full max-w-xs sm:w-72">
            <Label
              htmlFor="event-type-filter"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Event type
            </Label>
            <Input
              id="event-type-filter"
              list="event-type-filter-options"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              placeholder={
                eventTypeOptions.length > 0
                  ? "Search event types..."
                  : "No event types to filter"
              }
              aria-label="Filter by event type"
              autoComplete="off"
              disabled={eventTypeOptions.length === 0}
            />
            <datalist id="event-type-filter-options">
              {eventTypeOptions.map((title) => (
                <option key={title} value={title} />
              ))}
            </datalist>
          </div>
          {eventTypeFilter && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear event type filter"
              onClick={() => setEventTypeFilter("")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <TabsContent value="upcoming">
          {filteredBookings.length === 0 ? (
            renderEmptyState("upcoming")
          ) : (
            <BookingsTable
              bookings={filteredBookings}
              category="upcoming"
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
              category="past"
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
              category="cancelled"
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
                    {selectedBooking.guest_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedBooking.guest_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedBooking.guest_email}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-border p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">{selectedBooking.event_type_title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">
                    {formatDateTime(selectedBooking.start_at).date} ·{" "}
                    {formatDateTime(selectedBooking.start_at).time} –{" "}
                    {formatDateTime(selectedBooking.end_at).time}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">{selectedBooking.guest_timezone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">{selectedBooking.guest_email}</span>
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
                    selectedBooking.status === "confirmed"
                      ? "success"
                      : selectedBooking.status === "cancelled"
                      ? "danger"
                      : "secondary"
                  }
                >
                  {selectedBooking.status === "confirmed"
                    ? new Date(selectedBooking.start_at) > new Date()
                      ? "Confirmed"
                      : "Completed"
                    : "Cancelled"}
                </Badge>
              </div>
            </div>
          )}
        </DrawerContent>
        <DrawerFooter>
          {selectedBooking?.status === "confirmed" &&
            new Date(selectedBooking.start_at) > new Date() && (
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
              {selectedBooking?.guest_name}? This action cannot be undone.
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
            <Button
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling..." : "Confirm cancellation"}
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
  category,
  onBookingClick,
}: {
  bookings: Booking[];
  category: BookingCategory;
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
              {bookings.map((booking) => {
                const { date, time: startTime } = formatDateTime(booking.start_at);
                const { time: endTime } = formatDateTime(booking.end_at);
                return (
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
                        {getStatusLabel(category)}
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
          const { date, time: startTime } = formatDateTime(booking.start_at);
          const { time: endTime } = formatDateTime(booking.end_at);
          return (
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
                    {getStatusLabel(category)}
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
