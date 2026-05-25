import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface DemoHostConfig {
  authUserId: string;
  email: string;
  password: string;
}

const defaultDemoHost: DemoHostConfig = {
  authUserId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  email: "demo@openslot.dev",
  password: "demo-password-123",
};

let runtimeDemoHost: Partial<DemoHostConfig> | null | undefined;

export const demoHost: DemoHostConfig = {
  get authUserId() {
    return (
      process.env.E2E_DEMO_AUTH_USER_ID ??
      readRuntimeDemoHost()?.authUserId ??
      defaultDemoHost.authUserId
    );
  },
  get email() {
    return (
      process.env.E2E_DEMO_HOST_EMAIL ??
      process.env.E2E_DEMO_EMAIL ??
      readRuntimeDemoHost()?.email ??
      defaultDemoHost.email
    );
  },
  get password() {
    return (
      process.env.E2E_DEMO_HOST_PASSWORD ??
      process.env.E2E_DEMO_PASSWORD ??
      readRuntimeDemoHost()?.password ??
      defaultDemoHost.password
    );
  },
};

export function setRuntimeDemoHost(config: DemoHostConfig) {
  process.env.E2E_DEMO_AUTH_USER_ID = config.authUserId;
  process.env.E2E_DEMO_HOST_EMAIL = config.email;
  process.env.E2E_DEMO_HOST_PASSWORD = config.password;
  runtimeDemoHost = config;

  const filePath = runtimeDemoHostPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function resetRuntimeDemoHostForTests() {
  runtimeDemoHost = undefined;
  delete process.env.E2E_DEMO_AUTH_USER_ID;
  delete process.env.E2E_DEMO_HOST_EMAIL;
  delete process.env.E2E_DEMO_HOST_PASSWORD;
}

function readRuntimeDemoHost(): Partial<DemoHostConfig> | null {
  if (runtimeDemoHost !== undefined) return runtimeDemoHost;

  const filePath = runtimeDemoHostPath();
  if (!existsSync(filePath)) {
    runtimeDemoHost = null;
    return runtimeDemoHost;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<
      Record<keyof DemoHostConfig, unknown>
    >;
    runtimeDemoHost = {
      authUserId:
        typeof parsed.authUserId === "string" ? parsed.authUserId : undefined,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      password:
        typeof parsed.password === "string" ? parsed.password : undefined,
    };
  } catch {
    runtimeDemoHost = null;
  }

  return runtimeDemoHost;
}

function runtimeDemoHostPath() {
  return (
    process.env.E2E_DEMO_HOST_FILE ??
    path.join(process.cwd(), ".e2e-auth", "demo-host.json")
  );
}

export const demoIds = {
  eventType30Min: "c3d4e5f6-a7b8-9012-cdef-123456789012",
  eventType60Min: "d4e5f6a7-b8c9-0123-defa-234567890123",
  booking: "e5f6a7b8-c9d0-1234-efab-345678901234",
  contact: "f6a7b8c9-d0e1-2345-fabc-456789012345",
  cancellationToken: "11111111-1111-4111-8111-111111111111",
  rescheduleToken: "22222222-2222-4222-8222-222222222222",
};
