import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  loadEnv: vi.fn(),
}));

vi.mock("../../../e2e/support/db/client", () => ({
  createE2EAdminClient: mocks.createAdminClient,
}));

vi.mock("../../../e2e/support/env", () => ({
  loadE2EEnv: mocks.loadEnv,
}));

import globalSetup from "../../../e2e/global-setup";

describe("E2E global setup target guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadEnv.mockReturnValue({
      butterbaseAppId: "qa-app",
      butterbaseApiUrl: "https://api.butterbase.ai",
      butterbaseApiKey: "service-key",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails before creating an admin client for an external target without consent", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://preview.openslot.test");
    vi.stubEnv("E2E_ALLOW_EXTERNAL_MUTATIONS", "");

    await expect(globalSetup()).rejects.toThrow(
      "E2E_ALLOW_EXTERNAL_MUTATIONS=true"
    );

    expect(mocks.loadEnv).toHaveBeenCalledOnce();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
