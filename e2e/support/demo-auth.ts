import { randomUUID } from "node:crypto";
import type { BackendPorts, BackendSession } from "@/lib/backend/ports";
import { demoHost, setRuntimeDemoHost } from "../demo-data";
import {
  readDemoHostBackendSessionTokens,
  saveDemoHostSessionState,
} from "./auth-state";
import type { E2EAdminClient } from "./db/types";

interface DemoAuthCredentials {
  authUserId?: string;
  email: string;
  password: string;
}

export interface DemoAuthSessionSetup {
  userId: string;
  session: BackendSession;
}

export async function ensureDemoAuthUser(
  backend: BackendPorts,
  adminClient: E2EAdminClient
): Promise<string> {
  return (await ensureDemoAuthSession(backend, adminClient)).userId;
}

export async function ensureDemoAuthSession(
  backend: BackendPorts,
  adminClient: E2EAdminClient
): Promise<DemoAuthSessionSetup> {
  const cachedSession = await loadCachedDemoAuthSession(backend);
  if (cachedSession) {
    return cachedSession;
  }

  const signin = await signInDemoHost(backend);
  if (!signin.error) {
    return authSessionSetup(signin.data);
  }

  if (isAuthRateLimitError(signin.error.message)) {
    throw new Error(
      `Could not verify demo auth credentials because Butterbase auth is rate-limited: ${signin.error.message}`
    );
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

function createDemoAuthUser(backend: BackendPorts) {
  return backend.auth.signUp({
    email: demoHost.email,
    password: demoHost.password,
    displayName: "Demo User",
  });
}

function signInDemoHost(backend: BackendPorts) {
  return signInWithCredentials(backend, demoHost);
}

function signInWithCredentials(
  backend: BackendPorts,
  credentials: DemoAuthCredentials
) {
  return backend.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
}

async function loadCachedDemoAuthSession(
  backend: BackendPorts
): Promise<DemoAuthSessionSetup | null> {
  const tokens = readDemoHostBackendSessionTokens();
  if (!tokens) return null;

  if (tokens.accessToken) {
    const currentUser = await backend.auth.getCurrentUser(tokens.accessToken);
    if (!currentUser.error) {
      return {
        userId: currentUser.data.id,
        session: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: currentUser.data,
        },
      };
    }
  }

  if (!tokens.refreshToken) return null;

  const refreshed = await backend.auth.refreshSession(tokens.refreshToken);
  if (refreshed.error) return null;

  saveDemoHostSessionState(refreshed.data);
  return authSessionSetup(refreshed.data);
}

async function repairExistingDemoAuthUser(
  adminClient: E2EAdminClient,
  backend: BackendPorts,
  originalError: string
): Promise<DemoAuthSessionSetup | null> {
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
      return authSessionSetup(signin.data);
    }

    repairErrors.push(`${userId}: sign-in failed: ${signin.error.message}`);
  }

  const recreateResult = await recreateDemoAuthUser(
    adminClient,
    backend,
    candidateIds
  );
  if (recreateResult.setup) {
    return recreateResult.setup;
  }

  repairErrors.push(...recreateResult.errors);

  const replacementResult = await createReplacementDemoAuthUser(backend);
  if (replacementResult.setup) {
    return replacementResult.setup;
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
  backend: BackendPorts,
  candidateIds: string[]
): Promise<{ setup: DemoAuthSessionSetup | null; errors: string[] }> {
  const deleteUser = adminClient.auth.admin?.deleteUser;
  if (!deleteUser) {
    return {
      setup: null,
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
        const signin = await signInDemoHost(backend);
        if (!signin.error) {
          return { setup: authSessionSetup(signin.data), errors };
        }

        errors.push(
          `${userId}: recreate verification failed: ${signin.error.message}`
        );
        continue;
      } else {
        errors.push(
          `${userId}: recreate failed: signup did not return an auth user id`
        );
        continue;
      }
    }

    errors.push(`${userId}: recreate failed: ${signup.error.message}`);
  }

  return { setup: null, errors };
}

async function createReplacementDemoAuthUser(
  backend: BackendPorts
): Promise<{ setup: DemoAuthSessionSetup | null; error: string }> {
  const credentials = {
    email: `demo.e2e.${Date.now()}.${randomUUID().slice(0, 8)}@openslot.dev`,
    password:
      process.env.E2E_DEMO_HOST_PASSWORD ??
      process.env.E2E_DEMO_PASSWORD ??
      `E2e-Demo-${Date.now()}!Aa1`,
  };
  const signup = await backend.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    displayName: "Demo User",
  });

  if (signup.error) {
    return {
      setup: null,
      error: `replacement signup failed: ${signup.error.message}`,
    };
  }

  if (!signup.data.id) {
    return {
      setup: null,
      error: "replacement signup failed: signup did not return an auth user id",
    };
  }

  const runtimeCredentials = {
    authUserId: signup.data.id,
    email: credentials.email,
    password: credentials.password,
  };

  const verified = await signInWithCredentials(backend, credentials);
  if (verified.error) {
    if (isAuthRateLimitError(verified.error.message)) {
      setRuntimeDemoHost(runtimeCredentials);
      return {
        setup: null,
        error: `replacement verification failed after caching replacement credentials for retry: ${verified.error.message}`,
      };
    }

    return {
      setup: null,
      error: `replacement verification failed: ${verified.error.message}`,
    };
  }

  setRuntimeDemoHost(runtimeCredentials);

  return { setup: authSessionSetup(verified.data), error: "" };
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

function isAuthRateLimitError(message: string) {
  return /rate limit/i.test(message);
}

function authSessionSetup(session: BackendSession): DemoAuthSessionSetup {
  return {
    userId: session.user.id,
    session,
  };
}
