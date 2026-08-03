import { defineConfig } from "@playwright/test";
import { isLocalE2ETarget } from "./e2e/support/target-guard";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const parsedBaseURL = new URL(baseURL);
const viewport = {
  width: positiveInteger(process.env.PLAYWRIGHT_VIEWPORT_WIDTH, 1280),
  height: positiveInteger(process.env.PLAYWRIGHT_VIEWPORT_HEIGHT, 900),
};
const webServerHost = parsedBaseURL.hostname;
const webServerPort =
  parsedBaseURL.port || (parsedBaseURL.protocol === "https:" ? "443" : "80");
const shouldStartWebServer = isLocalE2ETarget(baseURL);
const webServerEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  )
);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    viewport,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/New_York",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: shouldStartWebServer
    ? {
        command: `npm run dev -- --hostname ${webServerHost} --port ${webServerPort}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...webServerEnv,
          TZ: process.env.TZ ?? "America/New_York",
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
        },
      }
    : undefined,
});

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
