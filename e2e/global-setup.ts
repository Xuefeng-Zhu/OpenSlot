import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { demoHost } from "./demo-data";

export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "E2E tests require NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    demoHost.authUserId,
    {
      email: demoHost.email,
      password: demoHost.password,
      email_confirm: true,
      app_metadata: {
        provider: "email",
        providers: ["email"],
      },
    }
  );

  if (updateError) {
    throw new Error(
      `Could not refresh seeded demo auth credentials: ${updateError.message}`
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
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
