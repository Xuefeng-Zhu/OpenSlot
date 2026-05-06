"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Pencil,
  ShieldCheck,
  Video,
} from "lucide-react";

import {
  AvatarPhoto,
  MiniCalendar,
  PoweredByOpenSlot,
} from "@/components/brand/booking-preview";
import { OpenSlotLogo } from "@/components/brand/openslot-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const timeSlots = ["9:00 AM", "10:30 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM"];

export default function PublicBookingPage() {
  const [selectedSlot, setSelectedSlot] = useState("10:30 AM");
  const [confirmed, setConfirmed] = useState(false);
  const [guestName, setGuestName] = useState("Jamie Miller");
  const [guestEmail, setGuestEmail] = useState("jamie.miller@example.com");
  const [notes, setNotes] = useState("");

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="mx-auto max-w-[620px] px-5 py-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-foreground">
            Booking confirmed
          </h1>
          <p className="mt-3 text-base font-medium text-muted-foreground">
            Your 30 min intro call with Alex Chen is booked for Friday, June 13, 2025 at {selectedSlot}.
          </p>
          <Card className="mt-8 bg-white text-left">
            <CardContent className="space-y-4 p-6 text-sm font-medium">
              <SummaryLine label="Event" value="30 min intro call" />
              <SummaryLine label="Host" value="Alex Chen" />
              <SummaryLine label="When" value={`Friday, June 13, 2025, ${selectedSlot} - 11:00 AM`} />
              <SummaryLine label="Location" value="Google Meet" />
            </CardContent>
          </Card>
          <Button asChild className="mt-8">
            <Link href="/alex">Back to Alex page</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen openslot-page-glow">
      <PublicHeader />
      <main className="mx-auto max-w-[1260px] px-5 py-6 lg:px-8">
        <Link
          href="/alex"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Alex page
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[430px_1fr]">
          <aside>
            <Card className="overflow-hidden bg-white">
              <CardContent className="p-0">
                <div className="p-7">
                  <div className="flex items-center gap-6">
                    <AvatarPhoto className="h-28 w-28" />
                    <div>
                      <h1 className="text-2xl font-extrabold text-foreground">
                        Alex Chen
                      </h1>
                      <p className="mt-2 font-medium text-muted-foreground">
                        Product Designer
                      </p>
                      <Link
                        href="/alex"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary"
                      >
                        View Alex page
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border p-7">
                  <h2 className="text-2xl font-extrabold text-foreground">
                    30 min intro call
                  </h2>
                  <div className="mt-5 space-y-4 text-sm font-bold text-muted-foreground">
                    <Fact icon={<Clock3 className="h-5 w-5" />} text="30 minutes" />
                    <Fact icon={<Video className="h-5 w-5" />} text="Google Meet" />
                    <Fact icon={<CalendarDays className="h-5 w-5" />} text="One-on-one" />
                  </div>
                  <div className="my-7 h-px bg-border" />
                  <h3 className="font-extrabold text-foreground">About this call</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
                    A friendly 30-minute intro call to learn more about your goals
                    and explore how I can help.
                  </p>
                  <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
                    No prep needed, just come as you are.
                  </p>
                </div>

                <div className="border-t border-border p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="font-extrabold text-foreground">
                      Booking summary
                    </h3>
                    <Button variant="ghost" size="sm" className="text-primary">
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  </div>
                  <div className="space-y-4 text-sm">
                    <SummaryLine label="Event" value="30 min intro call" />
                    <SummaryLine label="Host" value="Alex Chen" />
                    <SummaryLine label="Duration" value="30 minutes" />
                    <SummaryLine label="Location" value="Google Meet" />
                    <SummaryLine label="Timezone" value="America/New_York (EDT)" />
                    <SummaryLine label="When" value={`Friday, June 13, 2025, ${selectedSlot} - 11:00 AM`} />
                  </div>
                </div>

                <div className="flex gap-4 border-t border-border bg-muted/45 p-6">
                  <ShieldCheck className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p className="text-sm font-medium leading-6 text-muted-foreground">
                    <span className="font-extrabold text-foreground">
                      Your booking is secure and private.
                    </span>
                    <br />
                    We never share your information.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>

          <section>
            <Card className="overflow-hidden bg-white">
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-foreground">
                      Timezone
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-11 items-center gap-3 rounded-[10px] border border-border bg-white px-4 text-sm font-bold text-foreground shadow-sm"
                    >
                      <Globe2 className="h-5 w-5 text-primary" aria-hidden="true" />
                      America/New_York (EDT)
                    </button>
                  </div>
                  <div className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-primary/20 bg-primary/10 px-4 text-sm font-bold text-primary">
                    <Clock3 className="h-5 w-5" aria-hidden="true" />
                    This slot is held for 4:32
                  </div>
                </div>

                <div className="grid border-b border-border lg:grid-cols-[1fr_0.8fr]">
                  <div className="border-b border-border p-7 lg:border-b-0 lg:border-r">
                    <MiniCalendar className="mx-auto max-w-[430px]" />
                    <p className="mt-5 text-sm font-medium text-muted-foreground">
                      All times shown in America/New_York (EDT)
                    </p>
                  </div>
                  <div className="p-7">
                    <h2 className="text-xl font-extrabold text-foreground">
                      Friday, June 13, 2025
                    </h2>
                    <div className="mt-6 space-y-3">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`flex h-11 w-full items-center justify-center rounded-[8px] border text-sm font-bold transition-colors ${
                            selectedSlot === slot
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-white text-foreground hover:border-primary/45"
                          }`}
                        >
                          {slot}
                          {selectedSlot === slot && (
                            <Check className="ml-auto mr-4 h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-7">
                  <h2 className="font-extrabold text-foreground">Your details</h2>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Confirm your details to complete your booking.
                  </p>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                      <Label htmlFor="guest-name">Name *</Label>
                      <Input
                        id="guest-name"
                        value={guestName}
                        onChange={(event) => setGuestName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="guest-email">Email *</Label>
                      <Input
                        id="guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(event) => setGuestEmail(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-5">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Anything you would like Alex to know before the call?"
                      rows={4}
                    />
                    <p className="mt-1 text-right text-xs font-medium text-muted-foreground">
                      {notes.length}/500
                    </p>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline">
                      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                      Back
                    </Button>
                    <Button
                      className="sm:min-w-[360px]"
                      onClick={() => setConfirmed(true)}
                    >
                      Confirm booking
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-5 rounded-[14px] border border-primary/10 bg-primary/[0.07] p-4">
              <PoweredByOpenSlot />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="mx-auto flex h-[80px] max-w-[1440px] items-center justify-between rounded-b-[18px] border border-t-0 border-border bg-white px-7 shadow-sm sm:px-12">
      <OpenSlotLogo />
      <div className="hidden items-center gap-3 text-sm font-bold text-muted-foreground sm:flex">
        Powered by OpenSlot
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
    </header>
  );
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      {text}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}
