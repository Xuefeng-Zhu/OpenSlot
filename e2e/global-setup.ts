import { createClient } from "@supabase/supabase-js";
import { demoHost } from "./demo-data";
import { loadE2EEnv } from "./support/env";

export default async function globalSetup() {
  const env = loadE2EEnv();

  const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
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
