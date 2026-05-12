"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  FileText,
  Mail,
  ShieldX,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type {
  ContactSummary,
  ContactTimelineItem,
} from "@/lib/contacts/summaries";

interface ContactProfileClientProps {
  contact: ContactSummary;
  timeline: ContactTimelineItem[];
}

function formatDateTime(isoString: string): { date: string; time: string } {
  const date = new Date(isoString);

  return {
    date: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function statusBadge(status: string) {
  if (status === "cancelled") return { label: "Cancelled", variant: "danger" as const };
  if (status === "rescheduled") return { label: "Rescheduled", variant: "warning" as const };
  return { label: "Confirmed", variant: "success" as const };
}

export function ContactProfileClient({
  contact,
  timeline,
}: ContactProfileClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);

  const handleAnonymize = async () => {
    setAnonymizing(true);

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to anonymize contact");
      }

      toast({
        title: "Contact anonymized",
        description: "Guest details were scrubbed from matching booking records.",
      });
      setDialogOpen(false);
      router.push("/contacts");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to anonymize contact",
        variant: "destructive",
      });
    } finally {
      setAnonymizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <UserRound className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {contact.displayName}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {contact.displayEmail}
            </p>
          </div>
        </div>

        <Button variant="destructive" onClick={() => setDialogOpen(true)}>
          <ShieldX className="mr-2 h-4 w-4" aria-hidden="true" />
          Anonymize contact
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total" value={contact.totalBookings} />
        <Metric label="Upcoming" value={contact.upcomingCount} />
        <Metric label="Past" value={contact.pastCount + contact.rescheduledCount} />
        <Metric label="Cancelled" value={contact.cancelledCount} />
      </div>

      <section className="space-y-3" aria-labelledby="contact-timeline-heading">
        <div>
          <h2
            id="contact-timeline-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Meeting History
          </h2>
          <p className="text-sm text-muted-foreground">
            Confirmed, cancelled, and rescheduled bookings for this contact.
          </p>
        </div>

        {timeline.length === 0 ? (
          <div className="rounded-md border border-border p-6 text-sm text-muted-foreground">
            No booking history found.
          </div>
        ) : (
          <div className="rounded-md border border-border">
            <ol className="divide-y divide-border">
              {timeline.map((item) => {
                const start = formatDateTime(item.startAt);
                const end = formatDateTime(item.endAt);
                const status = statusBadge(item.status);

                return (
                  <li key={item.bookingId} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.eventTypeTitle}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          {start.date}
                        </p>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          {start.time} - {end.time}
                        </p>
                        {item.notes && (
                          <p className="flex items-start gap-2 text-sm text-muted-foreground">
                            <FileText
                              className="mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDateTime(item.occurredAt).date}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anonymize contact?</DialogTitle>
            <DialogDescription>
              This clears contact details and scrubs matching booking guest
              fields while preserving meeting times and statuses.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={anonymizing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleAnonymize}
              disabled={anonymizing}
            >
              {anonymizing ? "Anonymizing..." : "Anonymize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
