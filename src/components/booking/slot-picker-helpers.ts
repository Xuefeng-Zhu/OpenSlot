import type { TimeSlot } from "@/lib/availability/types";
import type { BookingAgentDraft } from "@/lib/booking-agent/types";
import type { SlotsByDate } from "@/components/booking/slot-picker-types";

export const SLOT_PREFETCH_DAYS = 60;

export function hasSlotsForDate(slotsByDate: SlotsByDate, date: string): boolean {
  return Object.prototype.hasOwnProperty.call(slotsByDate, date);
}

export function mergeBookingAgentDrafts(
  current: BookingAgentDraft,
  incoming: BookingAgentDraft
): BookingAgentDraft {
  const merged = { ...current, ...incoming };

  if (current.answers || incoming.answers) {
    merged.answers = {
      ...(current.answers ?? {}),
      ...(incoming.answers ?? {}),
    };
  }

  return merged;
}

export function holdIdempotencyKeyForSlot(slot: TimeSlot): string {
  return `${slot.start}:${slot.end}:${slot.slotToken ?? ""}`;
}
