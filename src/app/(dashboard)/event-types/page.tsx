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
    bookingUrl: "https://openslot.com/sarah-chen/30-min-intro-call",
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
    bookingUrl: "https://openslot.com/sarah-chen/strategy-session",
  },
  {
    id: "3",
    title: "Office hours",
    description: "Open office hours for quick questions, feedback, or anything on your mind.",
    durationMinutes: 45,
    locationType: "Zoom",
    slug: "office-hours",
    isActive: false,
    bookingUrl: "https://openslot.com/sarah-chen/office-hours",
  },
];

type FilterTab = "all" | "active" | "paused";

export default function EventTypesPage() {
  const { toast } = useToast();
  const [eventTypes] = useState<MockEventType[]>(mockEventTypes);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEventTypes = eventTypes.filter((et) => {
    // Filter by status
    if (activeFilter === "active" && !et.isActive) return false;
    if (activeFilter === "paused" && et.isActive) return false;
    // Filter by search
    if (searchQuery && !et.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
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
    window.open(`/sarah-chen/${slug}`, "_blank");
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
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Types</h1>
          <p className="text-muted-foreground">
            Create and manage the types of events people can book with you.
          </p>
        </div>
        <Button asChild>
          <Link href="/event-types/new">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            New event type
          </Link>
        </Button>
      </div>

      {/* Filter tabs and search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={activeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("all")}
            className="rounded-full"
          >
            All
          </Button>
          <Button
            variant={activeFilter === "active" ? "outline" : "ghost"}
            size="sm"
            onClick={() => setActiveFilter("active")}
            className={`rounded-full ${activeFilter === "active" ? "border-success/50 text-success" : ""}`}
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            Active
          </Button>
          <Button
            variant={activeFilter === "paused" ? "outline" : "ghost"}
            size="sm"
            onClick={() => setActiveFilter("paused")}
            className={`rounded-full ${activeFilter === "paused" ? "border-warning/50 text-warning" : ""}`}
          >
            <span className="mr-1.5 h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
            Paused
          </Button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search event types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search event types"
          />
        </div>
      </div>

      {/* Event type list */}
      {filteredEventTypes.length === 0 && eventTypes.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          heading="No event types yet"
          description="Create your first event type to start accepting bookings from guests."
          action={{
            label: "Create your first event type",
            onClick: () => (window.location.href = "/event-types/new"),
          }}
        />
      ) : filteredEventTypes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No event types match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
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

      {/* Pagination info */}
      {filteredEventTypes.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>Showing 1 to {filteredEventTypes.length} of {filteredEventTypes.length} event types</p>
        </div>
      )}
    </div>
  );
}
