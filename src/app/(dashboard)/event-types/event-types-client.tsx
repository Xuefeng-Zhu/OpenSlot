"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  errorToastDescription,
  requestJson,
} from "@/components/dashboard/request-json";
import { Button } from "@/components/ui/button";
import {
  DeleteEventTypeDialog,
  EventTypesFilters,
  EventTypesListPanel,
  EventTypesResultCount,
} from "./event-types-client-panels";
import { useToast } from "@/components/ui/use-toast";
import { copyTextToClipboard } from "@/lib/utils/clipboard";

export type FilterTab = "all" | "active" | "paused";

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

type DeleteEventTypeResponse =
  | {
      success: true;
    }
  | {
      success: false;
      error?: string;
    };

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
      await copyTextToClipboard(bookingUrl);
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
      const result = await requestJson<DeleteEventTypeResponse>(
        `/api/event-types/${id}`,
        { method: "DELETE" },
        "Please try again."
      );

      if (!result.success) {
        throw new Error(result.error ?? "Please try again.");
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
    } catch (error) {
      toast({
        title: "Could not delete event type",
        description: errorToastDescription(error),
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

      <EventTypesFilters
        activeCount={activeCount}
        activeFilter={activeFilter}
        eventTypeCount={eventTypes.length}
        pausedCount={pausedCount}
        searchQuery={searchQuery}
        onFilterChange={setActiveFilter}
        onSearchQueryChange={setSearchQuery}
      />

      <EventTypesListPanel
        eventTypes={eventTypes}
        filteredEventTypes={filteredEventTypes}
        onClearFilters={() => {
          setSearchQuery("");
          setActiveFilter("all");
        }}
        onCopyLink={handleCopyLink}
        onCreateFirst={() => router.push("/event-types/new")}
        onDelete={setPendingDelete}
        onEdit={(eventType) => router.push(`/event-types/${eventType.id}/edit`)}
        onPreview={handlePreview}
      />

      <DeleteEventTypeDialog
        deletingId={deletingId}
        eventType={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={(eventType) => handleDelete(eventType.id, eventType.title)}
      />

      <EventTypesResultCount
        eventTypeCount={eventTypes.length}
        filteredEventTypeCount={filteredEventTypes.length}
      />
    </div>
  );
}
