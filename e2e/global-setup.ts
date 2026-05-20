import { createButterbaseBackend } from "../src/lib/backend/butterbase/adapter";
import { demoHost } from "./demo-data";
import { createE2EAdminClient } from "./support/db/client";
import { loadE2EEnv } from "./support/env";
import type { E2EAdminClient } from "./support/db/types";

export default async function globalSetup() {
  const env = loadE2EEnv();
  const adminClient = createE2EAdminClient();
  const backend = createButterbaseBackend({
    appId: env.butterbaseAppId,
    apiUrl: env.butterbaseApiUrl,
    apiKey: env.butterbaseApiKey,
  });

  const demoAuthUserId = await ensureDemoAuthUser(backend);
  await ensureDemoProfile(adminClient, demoAuthUserId);

  const { error: signInError } = await backend.auth.signInWithPassword({
    email: demoHost.email,
    password: demoHost.password,
  });

  if (signInError) {
    throw new Error(
      `Seeded demo auth credentials failed verification: ${signInError.message}`
    );
  }

}

async function ensureDemoAuthUser(
  backend: ReturnType<typeof createButterbaseBackend>
): Promise<string> {
  const signup = await backend.auth.signUp({
    email: demoHost.email,
    password: demoHost.password,
    displayName: "Demo User",
  });

  if (!signup.error) {
    return signup.data.id;
  }

  const signin = await backend.auth.signInWithPassword({
    email: demoHost.email,
    password: demoHost.password,
  });

  if (signin.error) {
    throw new Error(
      `Could not create or verify demo auth credentials: ${signin.error.message}`
    );
  }

  return signin.data.user.id;
}

async function ensureDemoProfile(
  adminClient: E2EAdminClient,
  authUserId: string
) {
  const profileId = await upsertDemoProfile(adminClient, authUserId);
  const scheduleId = await ensureDefaultSchedule(adminClient, profileId);
  await ensureWeekdayAvailability(adminClient, profileId, scheduleId);
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
