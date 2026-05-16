import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "../../../src/lib/types/database";

export type E2EAdminClient = SupabaseClient<Database>;

export interface DemoProfile {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  username: string;
  defaultTimezone: string;
}

export interface CreatedEventType {
  id: string;
  profile: DemoProfile;
  title: string;
  slug: string;
  durationMinutes: number;
}

export interface CreatedBooking {
  id: string;
  cancellationToken: string;
  rescheduleToken: string;
  guestEmail: string;
  guestName: string;
  startAt: string;
  endAt: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DemoStateSnapshot {
  profile: Tables<"profiles">;
  settings: Tables<"user_settings"> | null;
}

export interface AvailabilitySnapshot {
  profileId: string;
  rules: Tables<"availability_rules">[];
  overrides: Tables<"availability_overrides">[];
}
