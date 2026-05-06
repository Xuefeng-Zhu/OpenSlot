"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Calendar, Search } from "lucide-react";
import { EventTypeCard } from "@/components/dashboard/event-type-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

interface MockEventType {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  locationType: string;
  slug: string;
  isActive: boolean;
  bookingUrl: string;
}

const mockEventTypes: MockEventType[] = [
  {
    id: "1",
    title: "30 min intro call",
    description:
      "A quick 30-minute call to connect, learn about your needs, and see how we can help.",
    durationMinutes: 30,
    locationType: "Zoom",
    slug: "30-min-intro-call",
    isActive: true,
    bookingUrl: "https://openslot.com/sarahchen/30-min-intro-call",
  },
  {
    id: "2",
    title: "Strategy session",
    description:
      "A 60-minute deep dive to explore your goals, challenges, and opportunities.",
    durationMinutes: 60,
    locationType: "Google Meet",
    slug: "strategy-session",
    isActive: true,
    bookingUrl: "https://openslot.com/sarahchen/strategy-session",
  },
  {
    id: "3",
    title: "Office hours",
    description: "Open office hours for quick questions, feedback, or anything on your mind.",
    durationMinutes: 45,
    locationType: "Zoom",
    slug: "office-hours",
    isActive: false,
    bookingUrl: "https://openslot.com/sarahchen/office-hours",
  },
];

export default function EventTypesPage() {
  const { toast } = useToast();
  const [eventTypes] = useState<MockEventType[]>(mockEventTypes);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filteredEventTypes = eventTypes.filter((eventType) => {
    if (filter === "active" && !eventType.isActive) return false;
    if (filter === "paused" && eventType.isActive) return false;
    if (!query) return true;
    return eventType.title.toLowerCase().includes(query.toLowerCase());
  });

  const handleCopyLink = (bookingUrl: string) => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      toast({
        title: "Link copied!",
        description: "Booking URL has been copied to your clipboard.",
      });
    });
  };

  const handlePreview = (slug: string) => {
    window.open(`/johndoe/${slug}`, "_blank");
  };

  const handleEdit = (id: string) => {
    window.location.href = `/event-types/${id}/edit`;
  };

  const handleDelete = (id: string) => {
    toast({
      title: "Event type deleted",
      description: "The event type has been removed.",
      variant: "destructive",
    });
  };

  return (
    <div className="mx-auto max-w-[1220px] space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">Event Types</h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            Create and manage the types of events people can book with you.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/event-types/new">
            <Plus className="mr-2 h-5 w-5" aria-hidden="true" />
            New event type
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3">
          {[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`h-11 rounded-[10px] border px-8 text-sm font-bold transition-colors ${
                filter === item.value
                  ? "border-primary/20 bg-accent text-primary"
                  : "border-border bg-white text-foreground hover:border-primary/30"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:max-w-[320px]">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search event types..."
            className="pl-10"
          />
        </div>
      </div>

      {filteredEventTypes.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          heading="No event types yet"
          description="Create your first event type to start accepting bookings from guests."
          action={{
            label: "Create your first event type",
            onClick: () => (window.location.href = "/event-types/new"),
          }}
        />
      ) : (
        <div className="space-y-6">
          {filteredEventTypes.map((eventType) => (
            <EventTypeCard
              key={eventType.id}
              id={eventType.id}
              title={eventType.title}
              description={eventType.description}
              durationMinutes={eventType.durationMinutes}
              locationType={eventType.locationType}
              slug={eventType.slug}
              isActive={eventType.isActive}
              bookingUrl={eventType.bookingUrl}
              onCopyLink={() => handleCopyLink(eventType.bookingUrl)}
              onPreview={() => handlePreview(eventType.slug)}
              onEdit={() => handleEdit(eventType.id)}
              onDelete={() => handleDelete(eventType.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 text-sm font-medium text-muted-foreground sm:flex-row sm:items-center">
        <p>Showing 1 to {filteredEventTypes.length} of {eventTypes.length} event types</p>
        <div className="flex items-center gap-2 self-end">
          <Button variant="outline" size="icon" disabled>
            <span aria-hidden="true">&lt;</span>
          </Button>
          <Button variant="outline" size="icon" className="border-primary text-primary">
            1
          </Button>
          <Button variant="outline" size="icon" disabled>
            <span aria-hidden="true">&gt;</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
