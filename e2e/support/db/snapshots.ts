import { getDemoProfile } from "./demo-profile";
import type {
  AvailabilitySnapshot,
  DemoStateSnapshot,
  E2EAdminClient,
} from "./types";

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
  assertUserSettingsRowId(settingsRow);

  return {
    profile: profileRow,
    settings: settingsRow ?? null,
  };
}

function assertUserSettingsRowId(settingsRow: unknown) {
  if (!settingsRow) return;

  const id = (settingsRow as { id?: unknown }).id;
  if (typeof id === "string" && id.length > 0) return;

  throw new Error(
    "Butterbase test app is missing user_settings.id. Apply backend/database/migrations/20260524000000_add_user_settings_row_id.sql before running settings E2E."
  );
}

export async function restoreDemoState(
  adminClient: E2EAdminClient,
  snapshot: DemoStateSnapshot
) {
  const { error: profileError } = await adminClient
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

  if (profileError) {
    throw new Error(`Could not restore demo profile: ${profileError.message}`);
  }

  if (snapshot.settings) {
    const { error } = await adminClient
      .from("user_settings")
      .upsert(snapshot.settings, { onConflict: "profile_id" });

    if (error) {
      throw new Error(`Could not restore demo settings: ${error.message}`);
    }
  } else {
    const { error } = await adminClient
      .from("user_settings")
      .delete()
      .eq("profile_id", snapshot.profile.id);

    if (error) {
      throw new Error(`Could not clear demo settings: ${error.message}`);
    }
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
  const { error: overridesDeleteError } = await adminClient
    .from("availability_overrides")
    .delete()
    .eq("user_id", snapshot.profileId);

  if (overridesDeleteError) {
    throw new Error(
      `Could not clear availability overrides: ${overridesDeleteError.message}`
    );
  }

  const { error: rulesDeleteError } = await adminClient
    .from("availability_rules")
    .delete()
    .eq("user_id", snapshot.profileId);

  if (rulesDeleteError) {
    throw new Error(`Could not clear availability rules: ${rulesDeleteError.message}`);
  }

  if (snapshot.rules.length > 0) {
    const { error } = await adminClient.from("availability_rules").insert(snapshot.rules);

    if (error) {
      throw new Error(`Could not restore availability rules: ${error.message}`);
    }
  }

  if (snapshot.overrides.length > 0) {
    const { error } = await adminClient
      .from("availability_overrides")
      .insert(snapshot.overrides);

    if (error) {
      throw new Error(`Could not restore availability overrides: ${error.message}`);
    }
  }
}
