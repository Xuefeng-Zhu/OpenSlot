"use client";

import { Calendar, Search } from "lucide-react";
import { EventTypeCard } from "@/components/dashboard/event-type-card";
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
import type { DashboardEventType, FilterTab } from "./event-types-client";

export function EventTypesFilters({
  activeCount,
  activeFilter,
  eventTypeCount,
  pausedCount,
  searchQuery,
  onFilterChange,
  onSearchQueryChange,
}: {
  activeCount: number;
  activeFilter: FilterTab;
  eventTypeCount: number;
  pausedCount: number;
  searchQuery: string;
  onFilterChange: (filter: FilterTab) => void;
  onSearchQueryChange: (query: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Filter event types"
      >
        <Button
          variant={activeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("all")}
          className="rounded-full"
          aria-pressed={activeFilter === "all"}
        >
          All ({eventTypeCount})
        </Button>
        <Button
          variant={activeFilter === "active" ? "outline" : "ghost"}
          size="sm"
          onClick={() => onFilterChange("active")}
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
          onClick={() => onFilterChange("paused")}
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
          onChange={(event) => onSearchQueryChange(event.target.value)}
          className="pl-9"
          aria-label="Search event types"
        />
      </div>
    </div>
  );
}

export function EventTypesListPanel({
  eventTypes,
  filteredEventTypes,
  onClearFilters,
  onCopyLink,
  onCreateFirst,
  onDelete,
  onEdit,
  onPreview,
}: {
  eventTypes: DashboardEventType[];
  filteredEventTypes: DashboardEventType[];
  onClearFilters: () => void;
  onCopyLink: (bookingUrl: string) => void;
  onCreateFirst: () => void;
  onDelete: (eventType: DashboardEventType) => void;
  onEdit: (eventType: DashboardEventType) => void;
  onPreview: (bookingUrl: string) => void;
}) {
  if (filteredEventTypes.length === 0 && eventTypes.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-6 w-6" />}
        heading="No event types yet"
        description="Create your first event type to start accepting bookings from guests."
        action={{
          label: "Create your first event type",
          onClick: onCreateFirst,
        }}
      />
    );
  }

  if (filteredEventTypes.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-6 w-6" aria-hidden="true" />}
        heading="No matching event types"
        description="Try a different search term or clear the status filter to see more booking options."
        action={{
          label: "Clear filters",
          onClick: onClearFilters,
          variant: "outline",
        }}
      />
    );
  }

  return (
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
          onCopyLink={() => onCopyLink(eventType.bookingUrl)}
          onPreview={() => onPreview(eventType.bookingUrl)}
          onEdit={() => onEdit(eventType)}
          onDelete={() => onDelete(eventType)}
        />
      ))}
    </div>
  );
}

export function DeleteEventTypeDialog({
  deletingId,
  eventType,
  onCancel,
  onConfirm,
}: {
  deletingId: string | null;
  eventType: DashboardEventType | null;
  onCancel: () => void;
  onConfirm: (eventType: DashboardEventType) => void;
}) {
  return (
    <Dialog
      open={!!eventType}
      onOpenChange={(open) => {
        if (!open && !deletingId) {
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete event type</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{eventType?.title}&quot;?
            Event types with existing bookings cannot be deleted; pause them
            instead to keep booking history intact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={!!deletingId}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => eventType && onConfirm(eventType)}
            disabled={!!deletingId}
          >
            {deletingId ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EventTypesResultCount({
  eventTypeCount,
  filteredEventTypeCount,
}: {
  eventTypeCount: number;
  filteredEventTypeCount: number;
}) {
  if (filteredEventTypeCount === 0) return null;

  return (
    <div
      className="flex items-center justify-between text-sm text-muted-foreground"
      aria-live="polite"
    >
      <p>
        Showing 1 to {filteredEventTypeCount} of {eventTypeCount} event types
      </p>
    </div>
  );
}
