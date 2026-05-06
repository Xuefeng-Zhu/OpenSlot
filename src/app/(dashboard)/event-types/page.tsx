"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Calendar } from "lucide-react";
import { EventTypeCard } from "@/components/dashboard/event-type-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
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
    title: "30-min Discovery Call",
    description:
      "A quick introductory call to discuss your needs and see if we're a good fit for working together.",
    durationMinutes: 30,
    locationType: "Online",
    slug: "discovery-call",
    isActive: true,
    bookingUrl: "https://openslot.app/johndoe/discovery-call",
  },
  {
    id: "2",
    title: "60-min Consultation",
    description:
      "An in-depth consultation session to dive deep into your project requirements and provide actionable advice.",
    durationMinutes: 60,
    locationType: "Online",
    slug: "consultation",
    isActive: true,
    bookingUrl: "https://openslot.app/johndoe/consultation",
  },
  {
    id: "3",
    title: "15-min Quick Chat",
    description: "A brief check-in for quick questions or follow-ups.",
    durationMinutes: 15,
    locationType: "Phone",
    slug: "quick-chat",
    isActive: false,
    bookingUrl: "https://openslot.app/johndoe/quick-chat",
  },
];

export default function EventTypesPage() {
  const { toast } = useToast();
  const [eventTypes] = useState<MockEventType[]>(mockEventTypes);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Types</h1>
          <p className="text-muted-foreground">
            Manage your event types that guests can book.
          </p>
        </div>
        <Button asChild>
          <Link href="/event-types/new">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Create event type
          </Link>
        </Button>
      </div>

      {eventTypes.length === 0 ? (
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {eventTypes.map((eventType) => (
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
    </div>
  );
}
