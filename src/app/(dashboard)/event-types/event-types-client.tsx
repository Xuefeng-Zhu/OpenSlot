"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Plus, Search } from "lucide-react";
import { EventTypeCard } from "@/components/dashboard/event-type-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

type FilterTab = "all" | "active" | "paused";

export interface DashboardEventType {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  locationType: string;
  slug: string;
  isActive: boolean;
  bookingUrl: string;
}

interface EventTypesClientProps {
  initialEventTypes: DashboardEventType[];
}

/**
 * Dashboard event type list with client-side filtering and delete confirmation.
 * Successful deletes update local state immediately, then refresh server data so
 * related dashboard surfaces stay in sync.
 */
export function EventTypesClient({
  initialEventTypes,
}: EventTypesClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [eventTypes, setEventTypes] = useState(initialEventTypes);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<DashboardEventType | null>(null);

  const filteredEventTypes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return eventTypes.filter((eventType) => {
      if (activeFilter === "active" && !eventType.isActive) return false;
      if (activeFilter === "paused" && eventType.isActive) return false;

      if (
        normalizedQuery &&
        !eventType.title.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }

      return true;
    });
  }, [activeFilter, eventTypes, searchQuery]);

  const activeCount = eventTypes.filter((eventType) => eventType.isActive).length;
  const pausedCount = eventTypes.length - activeCount;

  const handleCopyLink = async (bookingUrl: string) => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({
        title: "Link copied!",
        description: "Booking URL has been copied to your clipboard.",
      });
    } catch {
      toast({
        title: "Could not copy link",
        description: "Copy the URL from the preview page instead.",
        variant: "destructive",
      });
    }
  };

  const handlePreview = (bookingUrl: string) => {
    window.open(bookingUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (id: string, title: string) => {
    if (deletingId) return;

    setDeletingId(id);

    try {
      const response = await fetch(`/api/event-types/${id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        toast({
          title: "Could not delete event type",
          description: result?.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }

      setEventTypes((current) =>
        current.filter((eventType) => eventType.id !== id)
      );
      setPendingDelete(null);
      toast({
        title: "Event type deleted",
        description: `"${title}" has been removed.`,
      });
      router.refresh();
    } catch {
      toast({
        title: "Could not delete event type",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event types"
        description="Create focused booking options with the right duration, location, and public link."
        actions={
          <Button asChild>
            <Link href="/event-types/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New event type
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2" aria-label="Filter event types">
          <Button
            variant={activeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("all")}
            className="rounded-full"
            aria-pressed={activeFilter === "all"}
          >
            All ({eventTypes.length})
          </Button>
          <Button
            variant={activeFilter === "active" ? "outline" : "ghost"}
            size="sm"
            onClick={() => setActiveFilter("active")}
            className={`rounded-full ${activeFilter === "active" ? "border-success/50 text-success" : ""}`}
            aria-pressed={activeFilter === "active"}
          >
            <span
              className="mr-1.5 h-2 w-2 rounded-full bg-success"
              aria-hidden="true"
            />
            Active ({activeCount})
          </Button>
          <Button
            variant={activeFilter === "paused" ? "outline" : "ghost"}
            size="sm"
            onClick={() => setActiveFilter("paused")}
            className={`rounded-full ${activeFilter === "paused" ? "border-warning/50 text-warning" : ""}`}
            aria-pressed={activeFilter === "paused"}
          >
            <span
              className="mr-1.5 h-2 w-2 rounded-full bg-warning"
              aria-hidden="true"
            />
            Paused ({pausedCount})
          </Button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search event types..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9"
            aria-label="Search event types"
          />
        </div>
      </div>

      {filteredEventTypes.length === 0 && eventTypes.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          heading="No event types yet"
          description="Create your first event type to start accepting bookings from guests."
          action={{
            label: "Create your first event type",
            onClick: () => router.push("/event-types/new"),
          }}
        />
      ) : filteredEventTypes.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" aria-hidden="true" />}
          heading="No matching event types"
          description="Try a different search term or clear the status filter to see more booking options."
          action={{
            label: "Clear filters",
            onClick: () => {
              setSearchQuery("");
              setActiveFilter("all");
            },
            variant: "outline",
          }}
        />
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
              onPreview={() => handlePreview(eventType.bookingUrl)}
              onEdit={() => router.push(`/event-types/${eventType.id}/edit`)}
              onDelete={() => setPendingDelete(eventType)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{pendingDelete?.title}&quot;?
              Existing bookings for this event type will be removed too.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={!!deletingId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                pendingDelete &&
                handleDelete(pendingDelete.id, pendingDelete.title)
              }
              disabled={!!deletingId}
            >
              {deletingId ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filteredEventTypes.length > 0 && (
        <div
          className="flex items-center justify-between text-sm text-muted-foreground"
          aria-live="polite"
        >
          <p>
            Showing 1 to {filteredEventTypes.length} of {eventTypes.length} event
            types
          </p>
        </div>
      )}
    </div>
  );
}
