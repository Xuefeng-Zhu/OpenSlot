import { createClient, type User } from "@supabase/supabase-js";
import { demoHost } from "./demo-data";
import { loadE2EEnv } from "./support/env";
import type { Database } from "../src/lib/types/database";

export default async function globalSetup() {
  const env = loadE2EEnv();

  const adminClient = createClient<Database>(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const demoAuthUserId = await ensureDemoAuthUser(adminClient);
  await ensureDemoProfile(adminClient, demoAuthUserId);

  const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: demoHost.email,
    password: demoHost.password,
  });

  if (signInError) {
    throw new Error(
      `Seeded demo auth credentials failed verification: ${signInError.message}`
    );
  }

  await authClient.auth.signOut();
}

async function ensureDemoAuthUser(
  adminClient: ReturnType<typeof createClient<Database>>
): Promise<string> {
  const attributes = {
    email: demoHost.email,
    password: demoHost.password,
    email_confirm: true,
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
  };

  const { data: seededUserData, error: seededUpdateError } =
    await adminClient.auth.admin.updateUserById(
      demoHost.authUserId,
      attributes
    );

  if (!seededUpdateError && seededUserData.user) {
    return seededUserData.user.id;
  }

  if (!isMissingAuthUserError(seededUpdateError)) {
    throw new Error(
      `Could not refresh seeded demo auth credentials: ${
        seededUpdateError?.message ?? "missing user"
      }`
    );
  }

  const existingUser = await findAuthUserByEmail(adminClient, demoHost.email);

  if (existingUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(
      existingUser.id,
      attributes
    );

    if (error || !data.user) {
      throw new Error(
        `Could not refresh demo auth credentials: ${error?.message ?? "missing user"}`
      );
    }

    return data.user.id;
  }

  const { data, error } = await adminClient.auth.admin.createUser(attributes);

  if (error || !data.user) {
    throw new Error(
      `Could not create demo auth credentials: ${error?.message ?? "missing user"}`
    );
  }

  return data.user.id;
}

async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createClient<Database>>,
  email: string
): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Could not list auth users: ${error.message}`);
    }

    const user = data.users.find((item) => item.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }

  return null;
}

async function ensureDemoProfile(
  adminClient: ReturnType<typeof createClient<Database>>,
  authUserId: string
) {
  const profileId = await upsertDemoProfile(adminClient, authUserId);
  const scheduleId = await ensureDefaultSchedule(adminClient, profileId);
  await ensureWeekdayAvailability(adminClient, profileId, scheduleId);
}

async function upsertDemoProfile(
  adminClient: ReturnType<typeof createClient<Database>>,
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
  adminClient: ReturnType<typeof createClient<Database>>,
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
  adminClient: ReturnType<typeof createClient<Database>>,
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
  adminClient: ReturnType<typeof createClient<Database>>,
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

function isMissingAuthUserError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("user not found")
  );
}
