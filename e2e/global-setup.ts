import { randomUUID } from "node:crypto";
import { createButterbaseBackend } from "../src/lib/backend/butterbase/adapter";
import { demoHost, setRuntimeDemoHost } from "./demo-data";
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

  const demoAuthUserId = await ensureDemoAuthUser(backend, adminClient);
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

export async function ensureDemoAuthUser(
  backend: ReturnType<typeof createButterbaseBackend>,
  adminClient: E2EAdminClient
): Promise<string> {
  const signin = await signInDemoHost(backend);
  if (!signin.error) {
    return signin.data.user.id;
  }

  const repairResult = await repairExistingDemoAuthUser(
    adminClient,
    backend,
    signin.error.message
  );
  if (repairResult) {
    return repairResult;
  }

  throw new Error(
    `Could not create or verify demo auth credentials: ${signin.error.message}`
  );
}

function createDemoAuthUser(backend: ReturnType<typeof createButterbaseBackend>) {
  return backend.auth.signUp({
    email: demoHost.email,
    password: demoHost.password,
    displayName: "Demo User",
  });
}

function signInDemoHost(backend: ReturnType<typeof createButterbaseBackend>) {
  return backend.auth.signInWithPassword({
    email: demoHost.email,
    password: demoHost.password,
  });
}

async function repairExistingDemoAuthUser(
  adminClient: E2EAdminClient,
  backend: ReturnType<typeof createButterbaseBackend>,
  originalError: string
): Promise<string | null> {
  const candidateIds = await findDemoAuthUserIdCandidates(adminClient);
  const repairErrors: string[] = [];

  for (const userId of candidateIds) {
    const update = await adminClient.auth.updateUser({
      userId,
      email: demoHost.email,
      password: demoHost.password,
    });

    if (update.error) {
      repairErrors.push(`${userId}: update failed: ${update.error.message}`);
      continue;
    }

    const signin = await signInDemoHost(backend);
    if (!signin.error) {
      return signin.data.user.id;
    }

    repairErrors.push(`${userId}: sign-in failed: ${signin.error.message}`);
  }

  const recreateResult = await recreateDemoAuthUser(
    adminClient,
    backend,
    candidateIds
  );
  if (recreateResult.userId) {
    return recreateResult.userId;
  }

  repairErrors.push(...recreateResult.errors);

  const replacementResult = await createReplacementDemoAuthUser(backend);
  if (replacementResult.userId) {
    return replacementResult.userId;
  }

  repairErrors.push(replacementResult.error);

  if (repairErrors.length > 0) {
    throw new Error(
      `Could not repair seeded demo auth credentials after sign-in failed with "${originalError}": ${repairErrors.join("; ")}`
    );
  }

  return null;
}

async function recreateDemoAuthUser(
  adminClient: E2EAdminClient,
  backend: ReturnType<typeof createButterbaseBackend>,
  candidateIds: string[]
): Promise<{ userId: string | null; errors: string[] }> {
  const deleteUser = adminClient.auth.admin?.deleteUser;
  if (!deleteUser) {
    return {
      userId: null,
      errors: ["admin auth deletion is unavailable"],
    };
  }

  const errors: string[] = [];

  for (const userId of candidateIds) {
    const deletion = await deleteUser(userId);
    if (deletion.error) {
      errors.push(`${userId}: delete failed: ${deletion.error.message}`);
      continue;
    }

    const signup = await createDemoAuthUser(backend);
    if (!signup.error) {
      if (signup.data.id) {
        return { userId: signup.data.id, errors };
      }

      errors.push(
        `${userId}: recreate failed: signup did not return an auth user id`
      );
      continue;
    }

    errors.push(`${userId}: recreate failed: ${signup.error.message}`);
  }

  return { userId: null, errors };
}

async function createReplacementDemoAuthUser(
  backend: ReturnType<typeof createButterbaseBackend>
): Promise<{ userId: string | null; error: string }> {
  const email = `demo.e2e.${Date.now()}.${randomUUID().slice(0, 8)}@openslot.dev`;
  const password =
    process.env.E2E_DEMO_HOST_PASSWORD ??
    process.env.E2E_DEMO_PASSWORD ??
    `E2e-Demo-${Date.now()}!Aa1`;
  const signup = await backend.auth.signUp({
    email,
    password,
    displayName: "Demo User",
  });

  if (signup.error) {
    return {
      userId: null,
      error: `replacement signup failed: ${signup.error.message}`,
    };
  }

  if (!signup.data.id) {
    return {
      userId: null,
      error: "replacement signup failed: signup did not return an auth user id",
    };
  }

  setRuntimeDemoHost({
    authUserId: signup.data.id,
    email,
    password,
  });

  return { userId: signup.data.id, error: "" };
}

async function findDemoAuthUserIdCandidates(
  adminClient: E2EAdminClient
): Promise<string[]> {
  const fields = "auth_user_id";
  const attempts = [
    { field: "auth_user_id", value: demoHost.authUserId },
    { field: "username", value: "demo" },
    { field: "email", value: demoHost.email },
  ];
  const candidates = new Set<string>();

  for (const attempt of attempts) {
    const { data, error } = await adminClient
      .from("profiles")
      .select(fields)
      .eq(attempt.field, attempt.value)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not inspect demo profile: ${error.message}`);
    }

    if (data?.auth_user_id) {
      candidates.add(data.auth_user_id);
    }
  }

  candidates.add(demoHost.authUserId);
  return Array.from(candidates);
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
