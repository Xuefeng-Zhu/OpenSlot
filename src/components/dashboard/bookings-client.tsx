"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  Mail,
  Clock,
  Globe,
  FileText,
  Video,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { formatBookingLocationLabel } from "@/lib/location-labels";
import { formatBookingAnswerValue } from "@/lib/validations/invitee-questions";
import { BookingsTable } from "@/components/dashboard/bookings-table";
import { formatBookingDateTime } from "@/components/dashboard/bookings-format";

interface BookingsClientProps {
  bookings: Booking[];
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
    const messages: Record<
      BookingCategory,
      { heading: string; description: string }
    > = {
      upcoming: {
        heading: "No upcoming bookings",
        description:
          "Share your booking link or create another event type to make it easy for guests to book.",
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
        action={
          tab === "upcoming"
            ? {
                label: "Open overview",
                onClick: () => {
                  window.location.href = "/dashboard";
                },
                variant: "outline",
              }
            : undefined
        }
      />
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Review upcoming, completed, and cancelled meetings with guest details close at hand."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BookingCategory)}>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <TabsList
            aria-label="Booking status"
            className="gap-2 border-0 bg-transparent p-0 text-foreground"
          >
            <TabsTrigger
              value="upcoming"
              className="rounded-full border border-border bg-background px-3 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Upcoming ({categorized.upcoming.length})
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="rounded-full border border-transparent px-3 data-[state=active]:border-primary/40 data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              Past ({categorized.past.length})
            </TabsTrigger>
            <TabsTrigger
              value="cancelled"
              className="rounded-full border border-transparent px-3 data-[state=active]:border-primary/40 data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              Cancelled ({categorized.cancelled.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
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
                className="pl-9"
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
          <p className="sr-only" aria-live="polite">
            {filteredBookings.length} bookings shown
          </p>
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
                    {formatBookingDateTime(selectedBooking.start_at).date} ·{" "}
                    {formatBookingDateTime(selectedBooking.start_at).time} –{" "}
                    {formatBookingDateTime(selectedBooking.end_at).time}
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
                {bookingLocationLabel(selectedBooking) && (
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm">
                      {bookingLocationLabel(selectedBooking)}
                    </span>
                  </div>
                )}
                {selectedBooking.conference_url && (
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <a
                      href={selectedBooking.conference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open meeting link
                    </a>
                  </div>
                )}
                {!selectedBooking.conference_url &&
                  conferenceStatusText(selectedBooking) && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      {conferenceStatusText(selectedBooking)}
                    </div>
                  )}
                {selectedBooking.notes && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
                    <span className="text-sm">{selectedBooking.notes}</span>
                  </div>
                )}
                {(selectedBooking.booking_answers?.length ?? 0) > 0 && (
                  <div className="flex items-start gap-2">
                    <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div className="space-y-2 text-sm">
                      {selectedBooking.booking_answers?.map((answer) => (
                        <div key={answer.questionId}>
                          <p className="font-medium">{answer.label}</p>
                          <p className="text-muted-foreground">
                            {formatBookingAnswerValue(answer)}
                          </p>
                        </div>
                      ))}
                    </div>
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

function bookingLocationLabel(booking: Booking): string | null {
  return formatBookingLocationLabel({
    locationType: booking.location_type,
    locationValue: booking.location_value,
    conferenceProvider: booking.conference_provider,
  });
}

function conferenceStatusText(booking: Booking): string | null {
  if (!booking.conference_provider || booking.conference_status === "ready") {
    return null;
  }

  if (booking.conference_status === "setup_required") {
    return booking.conference_error ?? "Video provider setup is required.";
  }

  if (booking.conference_status === "failed") {
    return booking.conference_error ?? "Meeting link generation failed.";
  }

  return "Meeting link generation is pending.";
}
