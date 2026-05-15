import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoHost } from "../demo-data";
import { loadE2EEnv } from "./env";
import type {
  Database,
  InsertTables,
  Tables,
} from "../../src/lib/types/database";

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

export function createE2EAdminClient(): E2EAdminClient {
  const env = loadE2EEnv();

  return createClient<Database>(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function uniqueE2EId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export async function getDemoProfile(
  adminClient: E2EAdminClient
): Promise<DemoProfile> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, auth_user_id, email, name, username, default_timezone")
    .eq("auth_user_id", demoHost.authUserId)
    .single();

  if (error || !data) {
    throw new Error(
      `Could not load seeded demo profile: ${error?.message ?? "missing row"}`
    );
  }

  if (!data.username) {
    throw new Error("Seeded demo profile is missing a username.");
  }

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    email: data.email,
    name: data.name,
    username: data.username,
    defaultTimezone: data.default_timezone,
  };
}

export async function createEventType(
  adminClient: E2EAdminClient,
  overrides: Partial<InsertTables<"event_types">> = {}
): Promise<CreatedEventType> {
  const profile = await getDemoProfile(adminClient);
  const suffix = uniqueE2EId("e2e");
  const title =
    overrides.title ?? `E2E ${suffix.replace(/-/g, " ").toUpperCase()}`;
  const slug = overrides.slug ?? suffix;
  const durationMinutes = overrides.duration_minutes ?? 30;

  const { data, error } = await adminClient
    .from("event_types")
    .insert({
      user_id: profile.id,
      title,
      slug,
      description: "Created by the automated E2E suite.",
      duration_minutes: durationMinutes,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_minutes: 0,
      max_booking_days_ahead: 60,
      location_type: "online",
      location_value: "https://meet.example.com/e2e",
      is_active: true,
      ...overrides,
    })
    .select("id, title, slug, duration_minutes")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create E2E event type: ${error?.message ?? "missing row"}`
    );
  }

  return {
    id: data.id,
    profile,
    title: data.title,
    slug: data.slug,
    durationMinutes: data.duration_minutes,
  };
}

export async function createConfirmedBooking(
  adminClient: E2EAdminClient,
  {
    eventType,
    guestName,
    guestEmail,
    startAt,
    endAt,
    notes = "Created by the automated E2E suite.",
  }: {
    eventType: CreatedEventType;
    guestName: string;
    guestEmail: string;
    startAt: string;
    endAt: string;
    notes?: string;
  }
): Promise<CreatedBooking> {
  const { data, error } = await adminClient
    .from("bookings")
    .insert({
      event_type_id: eventType.id,
      host_user_id: eventType.profile.id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_timezone: "America/New_York",
      notes,
      start_at: startAt,
      end_at: endAt,
      status: "confirmed",
    })
    .select("id, cancellation_token, reschedule_token")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create E2E booking: ${error?.message ?? "missing row"}`
    );
  }

  await upsertContactForBooking(adminClient, {
    bookingId: data.id,
    hostUserId: eventType.profile.id,
    guestName,
    guestEmail,
  });

  return {
    id: data.id,
    cancellationToken: data.cancellation_token,
    rescheduleToken: data.reschedule_token,
    guestEmail,
    guestName,
    startAt,
    endAt,
  };
}

export async function createSlotHold(
  adminClient: E2EAdminClient,
  {
    eventType,
    slot,
    guestEmail,
  }: {
    eventType: CreatedEventType;
    slot: TimeSlot;
    guestEmail: string;
  }
) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await adminClient.rpc("create_slot_hold_with_reservation", {
    p_event_type_id: eventType.id,
    p_host_user_id: eventType.profile.id,
    p_start_at: slot.start,
    p_end_at: slot.end,
    p_guest_email: guestEmail,
    p_expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Could not create E2E slot hold: ${error.message}`);
  }
}

export async function cleanupEventType(
  adminClient: E2EAdminClient,
  eventTypeId: string
) {
  const { data: bookings } = await adminClient
    .from("bookings")
    .select("id, guest_email")
    .eq("event_type_id", eventTypeId);
  const bookingIds = (bookings ?? []).map((booking) => booking.id);
  const guestEmailHashes = (bookings ?? []).map((booking) =>
    hashContactEmail(booking.guest_email)
  );

  const { data: holds } = await adminClient
    .from("slot_holds")
    .select("id")
    .eq("event_type_id", eventTypeId);
  const holdIds = (holds ?? []).map((hold) => hold.id);

  if (bookingIds.length > 0) {
    await adminClient
      .from("host_reservations")
      .delete()
      .eq("source", "booking")
      .in("source_id", bookingIds);
    await adminClient
      .from("outbox_events")
      .delete()
      .eq("aggregate_type", "booking")
      .in("aggregate_id", bookingIds);
    await adminClient.from("booking_events").delete().in("booking_id", bookingIds);
  }

  if (holdIds.length > 0) {
    await adminClient
      .from("host_reservations")
      .delete()
      .eq("source", "hold")
      .in("source_id", holdIds);
  }

  await adminClient.from("event_types").delete().eq("id", eventTypeId);

  if (guestEmailHashes.length > 0) {
    const profile = await getDemoProfile(adminClient);
    await adminClient
      .from("contacts")
      .delete()
      .eq("host_user_id", profile.id)
      .in("email_hash", guestEmailHashes);
  }
}

export async function cleanupWebhookEndpointByUrl(
  adminClient: E2EAdminClient,
  url: string
) {
  const profile = await getDemoProfile(adminClient);
  await adminClient
    .from("webhook_endpoints")
    .delete()
    .eq("profile_id", profile.id)
    .eq("url", url);
}

export async function snapshotDemoState(
  adminClient: E2EAdminClient
): Promise<DemoStateSnapshot> {
  const profile = await getDemoProfile(adminClient);
  const { data: profileRow, error: profileError } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", profile.id)
    .single();

  if (profileError || !profileRow) {
    throw new Error(
      `Could not snapshot demo profile: ${profileError?.message ?? "missing row"}`
    );
  }

  const { data: settingsRow, error: settingsError } = await adminClient
    .from("user_settings")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (settingsError) {
    throw new Error(`Could not snapshot settings: ${settingsError.message}`);
  }

  return {
    profile: profileRow,
    settings: settingsRow ?? null,
  };
}

export async function restoreDemoState(
  adminClient: E2EAdminClient,
  snapshot: DemoStateSnapshot
) {
  await adminClient
    .from("profiles")
    .update({
      email: snapshot.profile.email,
      name: snapshot.profile.name,
      username: snapshot.profile.username,
      default_timezone: snapshot.profile.default_timezone,
      avatar_url: snapshot.profile.avatar_url,
      updated_at: snapshot.profile.updated_at,
    })
    .eq("id", snapshot.profile.id);

  if (snapshot.settings) {
    await adminClient.from("user_settings").upsert(snapshot.settings);
  } else {
    await adminClient
      .from("user_settings")
      .delete()
      .eq("profile_id", snapshot.profile.id);
  }
}

export async function snapshotAvailability(
  adminClient: E2EAdminClient
): Promise<AvailabilitySnapshot> {
  const profile = await getDemoProfile(adminClient);
  const { data: rules, error: rulesError } = await adminClient
    .from("availability_rules")
    .select("*")
    .eq("user_id", profile.id);

  if (rulesError) {
    throw new Error(`Could not snapshot availability rules: ${rulesError.message}`);
  }

  const { data: overrides, error: overridesError } = await adminClient
    .from("availability_overrides")
    .select("*")
    .eq("user_id", profile.id);

  if (overridesError) {
    throw new Error(
      `Could not snapshot availability overrides: ${overridesError.message}`
    );
  }

  return {
    profileId: profile.id,
    rules: rules ?? [],
    overrides: overrides ?? [],
  };
}

export async function restoreAvailability(
  adminClient: E2EAdminClient,
  snapshot: AvailabilitySnapshot
) {
  await adminClient
    .from("availability_overrides")
    .delete()
    .eq("user_id", snapshot.profileId);
  await adminClient
    .from("availability_rules")
    .delete()
    .eq("user_id", snapshot.profileId);

  if (snapshot.rules.length > 0) {
    await adminClient.from("availability_rules").insert(snapshot.rules);
  }

  if (snapshot.overrides.length > 0) {
    await adminClient.from("availability_overrides").insert(snapshot.overrides);
  }
}

async function upsertContactForBooking(
  adminClient: E2EAdminClient,
  {
    bookingId,
    hostUserId,
    guestName,
    guestEmail,
  }: {
    bookingId: string;
    hostUserId: string;
    guestName: string;
    guestEmail: string;
  }
) {
  const now = new Date().toISOString();

  await adminClient.from("contacts").upsert(
    {
      host_user_id: hostUserId,
      email_hash: hashContactEmail(guestEmail),
      display_name: guestName,
      last_guest_timezone: "America/New_York",
      first_seen_at: now,
      last_seen_at: now,
      last_booking_id: bookingId,
      deleted_at: null,
    },
    { onConflict: "host_user_id,email_hash" }
  );
}

function hashContactEmail(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}
