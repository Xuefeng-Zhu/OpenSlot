import { createButterbaseBackend } from "../src/lib/backend/butterbase/adapter";
import { demoHost, demoIds } from "./demo-data";
import { createE2EAdminClient } from "./support/db/client";
import {
  cleanupEventType,
  cleanupEventTypesBySlug,
} from "./support/db/cleanup";
import { ensureDemoAuthUser } from "./support/demo-auth";
import { loadE2EEnv } from "./support/env";
import type { E2EAdminClient } from "./support/db/types";

const janeGuestEmailHash =
  "9f4c07655c890f7bfa1ab7e0ac62ea8369a05f1ba57445af1a24fe0013c8baa1";
const staleDemoEventTypeAgeMs = 6 * 60 * 60 * 1000;

export default async function globalSetup() {
  const env = loadE2EEnv();
  const adminClient = createE2EAdminClient();
  const backend = createButterbaseBackend({
    appId: env.butterbaseAppId,
    apiUrl: env.butterbaseApiUrl,
    apiKey: env.butterbaseApiKey,
  });

  const demoAuthUserId = await ensureDemoAuthUser(backend, adminClient);
  const demoProfile = await ensureDemoProfile(adminClient, demoAuthUserId);
  await cleanupStaleDemoEventTypes(adminClient, demoProfile.profileId);
  await cleanupEventTypesBySlug(adminClient, [
    "30-minute-meeting",
    "60-minute-consultation",
  ]);
  await ensureDemoEventTypes(
    adminClient,
    demoProfile.profileId,
    demoProfile.scheduleId
  );
  await ensureDemoBooking(adminClient, demoProfile.profileId);
  await ensureDemoContact(adminClient, demoProfile.profileId);
}

async function ensureDemoProfile(
  adminClient: E2EAdminClient,
  authUserId: string
): Promise<{ profileId: string; scheduleId: string }> {
  const profileId = await upsertDemoProfile(adminClient, authUserId);
  const scheduleId = await ensureDefaultSchedule(adminClient, profileId);
  await ensureWeekdayAvailability(adminClient, profileId, scheduleId);
  return { profileId, scheduleId };
}

async function upsertDemoProfile(
  adminClient: E2EAdminClient,
  authUserId: string
): Promise<string> {
  const profileValues = {
    auth_user_id: authUserId,
    email: demoHost.email,
    name: "Demo User",
    username: "demo",
    default_timezone: "America/New_York",
    avatar_url: null,
  };

  const existingProfile = await findDemoProfile(adminClient, authUserId);

  if (existingProfile) {
    const { data, error } = await adminClient
      .from("profiles")
      .update(profileValues)
      .eq("id", existingProfile.id)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Could not update demo profile: ${error?.message ?? "missing row"}`
      );
    }

    return data.id;
  }

  const { data, error } = await adminClient
    .from("profiles")
    .insert(profileValues)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create demo profile: ${error?.message ?? "missing row"}`
    );
  }

  return data.id;
}

async function findDemoProfile(
  adminClient: E2EAdminClient,
  authUserId: string
): Promise<{ id: string } | null> {
  const byAuthUser = await adminClient
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (byAuthUser.error) {
    throw new Error(`Could not load demo profile: ${byAuthUser.error.message}`);
  }

  if (byAuthUser.data) return byAuthUser.data;

  const byUsername = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", "demo")
    .maybeSingle();

  if (byUsername.error) {
    throw new Error(`Could not load demo profile: ${byUsername.error.message}`);
  }

  return byUsername.data;
}

async function ensureDefaultSchedule(
  adminClient: E2EAdminClient,
  profileId: string
): Promise<string> {
  const { data: existingSchedule, error: lookupError } = await adminClient
    .from("schedules")
    .select("id")
    .eq("user_id", profileId)
    .eq("is_default", true)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not inspect demo schedule: ${lookupError.message}`);
  }

  if (existingSchedule) return existingSchedule.id;

  const { data, error } = await adminClient
    .from("schedules")
    .insert({
      user_id: profileId,
      name: "Default schedule",
      timezone: "America/New_York",
      is_default: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create demo schedule: ${error?.message ?? "missing row"}`
    );
  }

  return data.id;
}

async function ensureWeekdayAvailability(
  adminClient: E2EAdminClient,
  profileId: string,
  scheduleId: string
) {
  const { count, error } = await adminClient
    .from("availability_rules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profileId)
    .eq("schedule_id", scheduleId);

  if (error) {
    throw new Error(`Could not inspect demo availability: ${error.message}`);
  }

  if ((count ?? 0) > 0) return;

  const { error: insertError } = await adminClient
    .from("availability_rules")
    .insert(
      [1, 2, 3, 4, 5].map((weekday) => ({
        user_id: profileId,
        schedule_id: scheduleId,
        weekday,
        start_time: "09:00",
        end_time: "17:00",
        timezone: "America/New_York",
        is_active: true,
      }))
    );

  if (insertError) {
    throw new Error(`Could not create demo availability: ${insertError.message}`);
  }
}

export async function cleanupStaleDemoEventTypes(
  adminClient: E2EAdminClient,
  profileId: string
) {
  const staleCreatedBefore = new Date(
    Date.now() - staleDemoEventTypeAgeMs
  ).toISOString();
  const { data, error } = await adminClient
    .from("event_types")
    .select("id, title, slug")
    .eq("user_id", profileId)
    .lt("created_at", staleCreatedBefore);

  if (error) {
    throw new Error(`Could not inspect demo event types: ${error.message}`);
  }

  const eventTypes = (data ?? []) as Array<{
    id: string;
    title?: unknown;
    slug?: unknown;
  }>;
  const staleEventTypes = eventTypes.filter((eventType) => {
    const title = String(eventType.title ?? "");
    const slug = String(eventType.slug ?? "");
    return title.startsWith("E2E ") || slug.startsWith("e2e-");
  });

  for (const eventType of staleEventTypes) {
    await cleanupEventType(adminClient, eventType.id);
  }
}

async function ensureDemoEventTypes(
  adminClient: E2EAdminClient,
  profileId: string,
  scheduleId: string
) {
  const eventTypes = [
    {
      id: demoIds.eventType30Min,
      user_id: profileId,
      schedule_id: scheduleId,
      title: "30 Minute Meeting",
      slug: "30-minute-meeting",
      description: "A quick 30-minute meeting to discuss any topic.",
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 5,
      min_notice_minutes: 60,
      max_booking_days_ahead: 60,
      location_type: "online",
      location_value: "https://meet.example.com/demo",
      video_provider: null,
      is_active: true,
      reminder_enabled: true,
      reminder_minutes_before: 1440,
      reminder_guest_enabled: true,
      reminder_host_enabled: true,
    },
    {
      id: demoIds.eventType60Min,
      user_id: profileId,
      schedule_id: scheduleId,
      title: "60 Minute Consultation",
      slug: "60-minute-consultation",
      description: "An in-depth 60-minute consultation session.",
      duration_minutes: 60,
      buffer_before_minutes: 5,
      buffer_after_minutes: 10,
      min_notice_minutes: 120,
      max_booking_days_ahead: 60,
      location_type: "online",
      location_value: "https://meet.example.com/demo",
      video_provider: null,
      is_active: true,
      reminder_enabled: true,
      reminder_minutes_before: 1440,
      reminder_guest_enabled: true,
      reminder_host_enabled: true,
    },
  ];

  for (const eventType of eventTypes) {
    const { error } = await adminClient
      .from("event_types")
      .insert(eventType);

    if (error) {
      throw new Error(
        `Could not create demo event type ${eventType.slug}: ${error.message}`
      );
    }
  }
}

async function ensureDemoBooking(
  adminClient: E2EAdminClient,
  profileId: string
) {
  const { startAt, endAt } = demoBookingWindow();
  const { error } = await adminClient
    .from("bookings")
    .upsert(
      {
        id: demoIds.booking,
        event_type_id: demoIds.eventType30Min,
        host_user_id: profileId,
        guest_name: "Jane Guest",
        guest_email: "jane.guest@example.com",
        guest_timezone: "America/Chicago",
        notes: "Looking forward to discussing the project!",
        start_at: startAt,
        end_at: endAt,
        status: "confirmed",
        cancellation_token: demoIds.cancellationToken,
        reschedule_token: demoIds.rescheduleToken,
        location_type: "online",
        location_value: "https://meet.example.com/demo",
        conference_provider: null,
        conference_status: "not_required",
        conference_error: null,
      },
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(`Could not create demo booking: ${error.message}`);
  }
}

async function ensureDemoContact(
  adminClient: E2EAdminClient,
  profileId: string
) {
  const deleteById = await adminClient
    .from("contacts")
    .delete()
    .eq("id", demoIds.contact);

  if (deleteById.error) {
    throw new Error(`Could not reset demo contact: ${deleteById.error.message}`);
  }

  const deleteByEmail = await adminClient
    .from("contacts")
    .delete()
    .eq("host_user_id", profileId)
    .eq("email_hash", janeGuestEmailHash);

  if (deleteByEmail.error) {
    throw new Error(
      `Could not reset demo contact email: ${deleteByEmail.error.message}`
    );
  }

  const { error } = await adminClient
    .from("contacts")
    .insert({
      id: demoIds.contact,
      host_user_id: profileId,
      email_hash: janeGuestEmailHash,
      display_name: "Jane Guest",
      last_guest_timezone: "America/Chicago",
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      last_booking_id: demoIds.booking,
    });

  if (error) {
    throw new Error(`Could not create demo contact: ${error.message}`);
  }
}

function demoBookingWindow() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 14);
  start.setUTCHours(15, 0, 0, 0);

  const end = new Date(start);
  end.setUTCMinutes(end.getUTCMinutes() + 30);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}
