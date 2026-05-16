import { createClient } from "@supabase/supabase-js";
import { loadE2EEnv } from "../env";
import type { Database } from "../../../src/lib/types/database";
import type { E2EAdminClient } from "./types";

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
