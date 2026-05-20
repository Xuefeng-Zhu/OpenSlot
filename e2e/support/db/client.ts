import { createBackendCompatClient } from "../../../src/lib/backend/compat/query-client";
import { loadE2EEnv } from "../env";
import type { E2EAdminClient } from "./types";

export function createE2EAdminClient(): E2EAdminClient {
  const env = loadE2EEnv();

  return createBackendCompatClient({
    appId: env.butterbaseAppId,
    apiUrl: env.butterbaseApiUrl,
    apiKey: env.butterbaseApiKey,
    authMode: "service",
  });
}
