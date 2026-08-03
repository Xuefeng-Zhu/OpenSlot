"use client";

import { useState, useMemo } from "react";
import { Calendar, Search, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/components/ui/use-toast";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { BookingCancelDialog } from "@/components/dashboard/bookings-cancel-dialog";
import { BookingDetailsDrawer } from "@/components/dashboard/bookings-detail-drawer";
import {
  type Booking,
  type BookingCategory,
  categorizeBookings,
  filterBookingsByEventType,
} from "@/lib/booking-utils";
import { BookingsTable } from "@/components/dashboard/bookings-table";

interface BookingsClientProps {
  bookings: Booking[];
}

type BookingCancelResponse =
  | {
      success: true;
    }
  | {
      success: false;
      error?: string;
    };

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
      const data = await requestJson<BookingCancelResponse>(
        `/api/bookings/${selectedBooking.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cancellationToken: selectedBooking.cancellation_token,
            cancelReason: cancelReason || undefined,
          }),
        },
        "Failed to cancel booking"
      );

      if (!data.success) {
        throw new Error(data.error ?? "Failed to cancel booking");
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
        description: errorToastDescription(error),
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const renderEmptyState = (tab: BookingCategory) => {
    if (eventTypeFilter.trim()) {
      return (
        <EmptyState
          icon={<Search className="h-6 w-6" aria-hidden="true" />}
          heading="No matching bookings"
          description="Try another event type or clear the filter to see this booking status."
          action={{
            label: "Clear filter",
            onClick: () => setEventTypeFilter(""),
            variant: "outline",
          }}
        />
      );
    }

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

      <BookingDetailsDrawer
        booking={selectedBooking}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCancelBooking={() => setCancelDialogOpen(true)}
      />

      <BookingCancelDialog
        booking={selectedBooking}
        open={cancelDialogOpen}
        cancelReason={cancelReason}
        cancelling={cancelling}
        onOpenChange={setCancelDialogOpen}
        onCancelReasonChange={setCancelReason}
        onConfirm={handleCancelBooking}
      />
    </div>
  );
}
