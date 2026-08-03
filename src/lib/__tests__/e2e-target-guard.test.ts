import { describe, expect, it, vi } from "vitest";
import {
  assertSafeE2ETarget,
  E2E_BACKEND_APP_ID_HEADER,
  isLocalE2ETarget,
} from "../../../e2e/support/target-guard";

describe("external E2E target guard", () => {
  it.each([
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://[::1]:3000",
  ])("keeps local setup unchanged for %s", async (baseURL) => {
    const fetchMock = vi.fn();

    expect(isLocalE2ETarget(baseURL)).toBe(true);
    await expect(
      assertSafeE2ETarget({
        baseURL,
        expectedButterbaseAppId: "local-app",
        fetchImpl: fetchMock as typeof fetch,
      })
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects external targets without explicit mutation consent", async () => {
    const fetchMock = vi.fn();

    await expect(
      assertSafeE2ETarget({
        baseURL: "https://preview.openslot.test",
        expectedButterbaseAppId: "qa-app",
        fetchImpl: fetchMock as typeof fetch,
      })
    ).rejects.toThrow("E2E_ALLOW_EXTERNAL_MUTATIONS=true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS external targets before verification", async () => {
    const fetchMock = vi.fn();

    await expect(
      assertSafeE2ETarget({
        baseURL: "http://preview.openslot.test",
        expectedButterbaseAppId: "qa-app",
        allowExternalMutations: "true",
        fetchImpl: fetchMock as typeof fetch,
      })
    ).rejects.toThrow("External Playwright targets must use HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a deployment that does not advertise its Butterbase app id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));

    await expect(
      assertSafeE2ETarget({
        baseURL: "https://preview.openslot.test",
        expectedButterbaseAppId: "qa-app",
        allowExternalMutations: "true",
        fetchImpl: fetchMock as typeof fetch,
      })
    ).rejects.toThrow(`did not advertise ${E2E_BACKEND_APP_ID_HEADER}`);
  });

  it("rejects a deployment configured for a different Butterbase app", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { [E2E_BACKEND_APP_ID_HEADER]: "production-app" },
      })
    );

    await expect(
      assertSafeE2ETarget({
        baseURL: "https://preview.openslot.test",
        expectedButterbaseAppId: "qa-app",
        allowExternalMutations: "true",
        fetchImpl: fetchMock as typeof fetch,
      })
    ).rejects.toThrow(
      "advertises Butterbase app production-app, but the configured service key targets qa-app"
    );
  });

  it("allows an opted-in HTTPS deployment with a matching app id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { [E2E_BACKEND_APP_ID_HEADER]: "qa-app" },
      })
    );

    await expect(
      assertSafeE2ETarget({
        baseURL: "https://preview.openslot.test",
        expectedButterbaseAppId: "qa-app",
        allowExternalMutations: "true",
        fetchImpl: fetchMock as typeof fetch,
      })
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://preview.openslot.test"),
      expect.objectContaining({ method: "HEAD", redirect: "follow" })
    );
  });
});
