"use client";

import { useState } from "react";
import {
  Clock,
  MapPin,
  CheckCircle,
  CalendarPlus,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { TimeSlotButton } from "@/components/booking/time-slot-button";
import { TimezoneSelector } from "@/components/booking/timezone-selector";
import { BookingSummaryCard } from "@/components/booking/booking-summary-card";
import { HoldTimer } from "@/components/booking/hold-timer";

type BookingStep = "select-slot" | "fill-form" | "confirmed";

const mockSlots = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
];

const mockHost = {
  name: "Sarah Chen",
  username: "sarah-chen",
  avatarUrl: null as string | null,
};

const mockEvent = {
  title: "30 min intro call",
  duration: 30,
  location: "Online meeting",
  description:
    "A quick call to connect and learn more.",
};

export default function PublicBookingPage() {
  const [step, setStep] = useState<BookingStep>("select-slot");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [slotUnavailable, setSlotUnavailable] = useState(false);

  // Form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Hold timer - 10 minutes from now
  const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setSlotUnavailable(false);
    setStep("fill-form");
  };

  const handleHoldExpired = () => {
    setSlotUnavailable(true);
    setStep("select-slot");
    setSelectedSlot(null);
  };

  const handleSubmitBooking = () => {
    const errors: Record<string, string> = {};
    if (!guestName.trim()) errors.name = "Name is required";
    if (!guestEmail.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))
      errors.email = "Invalid email address";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setStep("confirmed");
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return "";
    return selectedDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Confirmation screen
  if (step === "confirmed") {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle className="h-8 w-8 text-success" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Booking Confirmed!</h1>
        <p className="mt-2 text-muted-foreground">
          Your booking with {mockHost.name} has been confirmed.
        </p>
        <Card className="mt-6 text-left">
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Event</span>
              <span className="font-medium">{mockEvent.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{formatSelectedDate()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{selectedSlot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timezone</span>
              <span className="font-medium">{timezone}</span>
            </div>
          </CardContent>
        </Card>
        <Button className="mt-6" variant="outline" asChild>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            aria-label="Add to calendar"
          >
            <CalendarPlus className="h-4 w-4 mr-2" aria-hidden="true" />
            Add to calendar
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Slot unavailable warning */}
      {slotUnavailable && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
          <p className="text-sm text-warning">
            Your held slot has expired. Please select a different time.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        {/* Left panel - Host info */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <Avatar
                  src={mockHost.avatarUrl}
                  alt={`${mockHost.name}'s avatar`}
                  fallback={mockHost.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                  size="md"
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  {mockHost.name}
                </p>
                <h1 className="mt-1 text-xl font-bold text-foreground">
                  {mockEvent.title}
                </h1>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    <span>{mockEvent.duration} min</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    <span>{mockEvent.location}</span>
                  </div>
                </div>
                {mockEvent.description && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {mockEvent.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right panel - Calendar/Slots or Form */}
        <div className="md:col-span-3">
          {step === "select-slot" && (
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Date picker */}
                <div>
                  <h2 className="text-sm font-medium text-foreground mb-3">
                    Select a date
                  </h2>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div>
                    <h2 className="text-sm font-medium text-foreground mb-3">
                      Available times for{" "}
                      {selectedDate.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {mockSlots.map((slot) => (
                        <TimeSlotButton
                          key={slot}
                          time={slot}
                          selected={selectedSlot === slot}
                          onClick={() => handleSlotSelect(slot)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Timezone selector */}
                <div>
                  <Label className="text-sm font-medium">Timezone</Label>
                  <TimezoneSelector
                    value={timezone}
                    onChange={setTimezone}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === "fill-form" && (
            <div className="space-y-4">
              {/* Hold timer */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Slot held for you:
                </p>
                <HoldTimer
                  expiresAt={holdExpiresAt}
                  onExpired={handleHoldExpired}
                />
              </div>

              {/* Booking summary */}
              <BookingSummaryCard
                hostName={mockHost.name}
                eventTitle={mockEvent.title}
                date={formatSelectedDate()}
                time={selectedSlot || ""}
                duration={mockEvent.duration}
                timezone={timezone}
              />

              {/* Booking form */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold">Your Details</h2>
                  <div>
                    <Label htmlFor="guest-name">Name</Label>
                    <Input
                      id="guest-name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Your full name"
                    />
                    {formErrors.name && (
                      <p className="text-xs text-destructive mt-1">
                        {formErrors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="guest-email">Email</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                    {formErrors.email && (
                      <p className="text-xs text-destructive mt-1">
                        {formErrors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="guest-notes">Notes (optional)</Label>
                    <Textarea
                      id="guest-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anything you'd like the host to know..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep("select-slot");
                        setSelectedSlot(null);
                      }}
                    >
                      Back
                    </Button>
                    <Button onClick={handleSubmitBooking} className="flex-1">
                      Confirm Booking
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
