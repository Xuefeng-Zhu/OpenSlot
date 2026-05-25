import type { TimeSlot } from "@/lib/availability/types";
import type { InviteeQuestion } from "@/lib/validations/invitee-questions";

export interface SlotPickerEventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration_minutes: number;
  location_type: string;
  location_value?: string | null;
  video_provider?: string | null;
  invitee_questions: InviteeQuestion[];
  user_id: string;
}

export interface SlotPickerHostProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

export interface SlotPickerRescheduleContext {
  token: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  currentStartAt: string;
  currentEndAt: string;
}

export interface HoldInfo {
  holdToken: string;
  expiresAt: string;
}

export interface BookingResult {
  bookingId: string;
  cancellationToken: string;
  rescheduleToken?: string;
  conferenceStatus?: string;
  conferenceUrl?: string | null;
  startAt: string;
  endAt: string;
  guestName: string;
  eventTitle: string;
}

export type SlotsByDate = Record<string, TimeSlot[]>;

export interface FetchSlotsOptions {
  force?: boolean;
}

export interface HoldResponseBody {
  error?: string;
  holdToken?: string;
  expiresAt?: string;
}

export type BookingFlowState =
  | { step: "select-slot" }
  | { step: "booking-form"; hold: HoldInfo | null; slot: TimeSlot }
  | { step: "confirmed"; booking: BookingResult };
