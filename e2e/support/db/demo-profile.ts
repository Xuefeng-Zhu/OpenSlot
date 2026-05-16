import { demoHost } from "../../demo-data";
import type { DemoProfile, E2EAdminClient } from "./types";

export async function getDemoProfile(
  adminClient: E2EAdminClient
): Promise<DemoProfile> {
  const data = await findDemoProfile(adminClient);

  if (!data) {
    throw new Error("Could not load seeded demo profile: missing row");
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

async function findDemoProfile(adminClient: E2EAdminClient) {
  const fields = "id, auth_user_id, email, name, username, default_timezone";
  const attempts = [
    { field: "auth_user_id", value: demoHost.authUserId },
    { field: "username", value: "demo" },
    { field: "email", value: demoHost.email },
  ];

  for (const attempt of attempts) {
    const { data, error } = await adminClient
      .from("profiles")
      .select(fields)
      .eq(attempt.field, attempt.value)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load seeded demo profile: ${error.message}`);
    }

    if (data) return data;
  }

  return null;
}
