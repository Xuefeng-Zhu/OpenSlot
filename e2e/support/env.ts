import { loadEnvConfig } from "@next/env";

export interface E2EEnv {
  butterbaseAppId: string;
  butterbaseApiUrl: string;
  butterbaseApiKey: string;
}

export function loadE2EEnv(): E2EEnv {
  loadEnvConfig(process.cwd());

  const butterbaseAppId = process.env.NEXT_PUBLIC_BUTTERBASE_APP_ID;
  const butterbaseApiUrl =
    process.env.NEXT_PUBLIC_BUTTERBASE_API_URL ?? "https://api.butterbase.ai";
  const butterbaseApiKey = process.env.BUTTERBASE_API_KEY;

  if (!butterbaseAppId || !butterbaseApiKey) {
    throw new Error(
      "E2E tests require NEXT_PUBLIC_BUTTERBASE_APP_ID and BUTTERBASE_API_KEY."
    );
  }

  return {
    butterbaseAppId,
    butterbaseApiUrl,
    butterbaseApiKey,
  };
}
