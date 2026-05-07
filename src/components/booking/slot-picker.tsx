"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, getInitials } from "@/components/ui/avatar";
import { BookingForm } from "@/components/booking/booking-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";

interface TimeSlot {
  start: string;
  end: string;
}

interface EventTypeInfo {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration_minutes: number;
  location_type: string;
  user_id: string;
}

interface HostProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

interface SlotPickerProps {
  eventType: EventTypeInfo;
  hostProfile: HostProfile;
}

interface HoldInfo {
  holdToken: string;
  expiresAt: string;
}

interface BookingResult {
  bookingId: string;
  cancellationToken: string;
  startAt: string;
  endAt: string;
  guestName: string;
  eventTitle: string;
}

type BookingFlowState =
  | { step: "select-slot" }
  | { step: "booking-form"; hold: HoldInfo; slot: TimeSlot }
  | { step: "confirmed"; booking: BookingResult };

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "Africa/Cairo",
  "Africa/Johannesburg",
];

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function SlotPicker({ eventType, hostProfile }: SlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timezone, setTimezone] = useState<string>("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [flowState, setFlowState] = useState<BookingFlowState>({
    step: "select-slot",
  });

  useEffect(() => {
    setTimezone(getBrowserTimezone());
  }, []);

  const fetchSlots = useCallback(
    async (date: Date, tz: string) => {
      setLoading(true);
      setError(null);
      setSlots([]);
      setSelectedSlot(null);

      const dateStr = format(date, "yyyy-MM-dd");

      try {
        const params = new URLSearchParams({
          hostUserId: hostProfile.id,
          eventTypeId: eventType.id,
          date: dateStr,
          timezone: tz,
        });

        const response = await fetch(`/api/slots?${params.toString()}`);

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          setError(
            data?.error || "Failed to fetch available slots. Please try again."
          );
          return;
        }

        const data = await response.json();
        setSlots(data.slots ?? []);
      } catch {
        setError(
          "Unable to load available slots. The service may be temporarily unavailable."
        );
      } finally {
        setLoading(false);
      }
    },
    [hostProfile.id, eventType.id]
  );

  useEffect(() => {
    if (selectedDate && timezone) {
      fetchSlots(selectedDate, timezone);
    }
  }, [selectedDate, timezone, fetchSlots]);

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date);
    setSelectedSlot(null);
    // Reset flow state when changing date
    if (flowState.step !== "confirmed") {
      setFlowState({ step: "select-slot" });
    }
  }

  function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    setSelectedSlot(null);
    // Reset flow state when changing timezone
    if (flowState.step !== "confirmed") {
      setFlowState({ step: "select-slot" });
    }
  }

  async function handleSlotSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    setHoldLoading(true);
    setError(null);

    try {
      // Create a hold on the selected slot
      const response = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeId: eventType.id,
          hostUserId: hostProfile.id,
          startAt: slot.start,
          endAt: slot.end,
          guestEmail: "pending@placeholder.com", // Will be updated on booking confirmation
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Slot taken — refresh slots
          setError(
            "This slot has been taken by another guest. Please select a different time."
          );
          setSelectedSlot(null);
          if (selectedDate) {
            fetchSlots(selectedDate, timezone);
          }
          return;
        }
        setError(data.error || "Failed to hold slot. Please try again.");
        setSelectedSlot(null);
        return;
      }

      // Hold created successfully — show booking form
      setFlowState({
        step: "booking-form",
        hold: {
          holdToken: data.holdToken,
          expiresAt: data.expiresAt,
        },
        slot,
      });
    } catch {
      setError("Unable to hold slot. Please try again.");
      setSelectedSlot(null);
    } finally {
      setHoldLoading(false);
    }
  }

  function handleBookingConfirmed(result: BookingResult) {
    setFlowState({ step: "confirmed", booking: result });
  }

  function handleHoldExpired() {
    setError(
      "Your hold has expired. Please select a new time slot."
    );
    setSelectedSlot(null);
    setFlowState({ step: "select-slot" });
    // Refresh slots to show updated availability
    if (selectedDate) {
      fetchSlots(selectedDate, timezone);
    }
  }

  function handleSlotTaken() {
    setError(
      "This slot has been booked by someone else. Please select a different time."
    );
    setSelectedSlot(null);
    setFlowState({ step: "select-slot" });
    // Refresh slots to show updated availability
    if (selectedDate) {
      fetchSlots(selectedDate, timezone);
    }
  }

  function formatSlotTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  }

  // Ensure the timezone list includes the browser timezone
  const timezoneOptions = COMMON_TIMEZONES.includes(timezone)
    ? COMMON_TIMEZONES
    : [timezone, ...COMMON_TIMEZONES];

  // If booking is confirmed, show the confirmation page
  if (flowState.step === "confirmed") {
    return (
      <div className="max-w-4xl mx-auto">
        <BookingConfirmation
          bookingId={flowState.booking.bookingId}
          cancellationToken={flowState.booking.cancellationToken}
          startAt={flowState.booking.startAt}
          endAt={flowState.booking.endAt}
          guestName={flowState.booking.guestName}
          eventTitle={flowState.booking.eventTitle}
          hostName={hostProfile.name}
          timezone={timezone}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Event type header */}
      <div className="flex flex-col items-center text-center mb-8">
        <Avatar
          src={hostProfile.avatar_url}
          alt={`${hostProfile.name}'s avatar`}
          fallback={getInitials(hostProfile.name) || "?"}
          size="lg"
          className="mb-3"
        />
        <p className="text-muted-foreground text-sm">{hostProfile.name}</p>
        <h1 className="text-2xl font-bold mt-1">{eventType.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">{eventType.duration_minutes} min</Badge>
          <Badge variant="outline">
            {formatLocationType(eventType.location_type)}
          </Badge>
        </div>
        {eventType.description && (
          <p className="text-muted-foreground mt-3 max-w-md">
            {eventType.description}
          </p>
        )}
      </div>

      {/* Timezone selector */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <label
          htmlFor="timezone-select"
          className="text-sm text-muted-foreground"
        >
          Timezone:
        </label>
        <Select value={timezone} onValueChange={handleTimezoneChange}>
          <SelectTrigger className="w-[280px]" id="timezone-select">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezoneOptions.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date picker and slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select a Date</CardTitle>
            <CardDescription>
              Choose a date to see available times
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) =>
                date < new Date(new Date().setHours(0, 0, 0, 0))
              }
            />
          </CardContent>
        </Card>

        {/* Available slots */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Times</CardTitle>
            <CardDescription>
              {selectedDate
                ? format(selectedDate, "EEEE, MMMM d, yyyy")
                : "Select a date to view available times"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDate && (
              <p className="text-muted-foreground text-sm text-center py-8">
                Please select a date from the calendar.
              </p>
            )}

            {selectedDate && loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading available slots...
                </span>
              </div>
            )}

            {selectedDate && !loading && error && (
              <div className="text-center py-8">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setError(null);
                    fetchSlots(selectedDate, timezone);
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}

            {selectedDate && !loading && !error && slots.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">
                No available slots for this date. Please try another date.
              </p>
            )}

            {selectedDate && !loading && !error && slots.length > 0 && (
              <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                {slots.map((slot) => (
                  <Button
                    key={slot.start}
                    variant={
                      selectedSlot?.start === slot.start ? "default" : "outline"
                    }
                    size="sm"
                    className="w-full"
                    onClick={() => handleSlotSelect(slot)}
                    disabled={holdLoading}
                  >
                    {holdLoading && selectedSlot?.start === slot.start
                      ? "Holding..."
                      : formatSlotTime(slot.start)}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking form (shown after hold is created) */}
      {flowState.step === "booking-form" && (
        <BookingForm
          holdToken={flowState.hold.holdToken}
          expiresAt={flowState.hold.expiresAt}
          selectedSlot={flowState.slot}
          eventTitle={eventType.title}
          hostName={hostProfile.name}
          timezone={timezone}
          onConfirmed={handleBookingConfirmed}
          onHoldExpired={handleHoldExpired}
          onSlotTaken={handleSlotTaken}
        />
      )}
    </div>
  );
}

function formatLocationType(locationType: string): string {
  switch (locationType) {
    case "online":
      return "Online";
    case "phone":
      return "Phone";
    case "in_person":
      return "In Person";
    case "custom":
      return "Custom";
    default:
      return locationType;
  }
}
