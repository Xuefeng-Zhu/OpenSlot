import { demoHost } from "./demo-data";
import { saveDemoHostAuthState } from "./support/auth";
import { allowBrowserConsoleErrors, expect, test } from "./support/test";

const protectedRoutes = [
  { path: "/dashboard", expectedUrl: /\/login\?returnUrl=%2Fdashboard$/ },
  { path: "/event-types", expectedUrl: /\/login\?returnUrl=%2Fevent-types$/ },
  { path: "/availability", expectedUrl: /\/login\?returnUrl=%2Favailability$/ },
  { path: "/bookings", expectedUrl: /\/login\?returnUrl=%2Fbookings$/ },
  { path: "/contacts", expectedUrl: /\/login\?returnUrl=%2Fcontacts$/ },
  { path: "/profile", expectedUrl: /\/login\?returnUrl=%2Fprofile$/ },
  { path: "/settings", expectedUrl: /\/login\?returnUrl=%2Fsettings$/ },
];

test.describe("authentication and access control", () => {
  test("protected host pages redirect signed-out visitors", async ({ page }) => {
    for (const route of protectedRoutes) {
      await test.step(route.path, async () => {
        await page.goto(route.path);
        await expect(page).toHaveURL(route.expectedUrl);
        await expect(
          page.getByRole("heading", { name: "Welcome back" })
        ).toBeVisible();
      });
    }
  });

  // Exercises the full sign-in journey with one successful auth attempt so the
  // shared Butterbase test app does not trip rate limits during the same spec.
  test("login validates fields, handles returnUrl, and persists a session", async ({
    page,
  }) => {
    await page.goto("/login?returnUrl=/event-types");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();

    await page.getByLabel("Email").fill(demoHost.email);
    await page.getByLabel("Password").fill("not-the-demo-password");
    allowBrowserConsoleErrors(page, [
      /Failed to load resource: the server responded with a status of (400|401)/,
    ]);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(
      page.getByText("We could not sign you in. Check your email and password.")
    ).toBeVisible();

    await page.getByLabel("Password").fill(demoHost.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/event-types$/);
    await saveDemoHostAuthState(page);
    await expect(
      page.getByRole("heading", { name: "Event types" })
    ).toBeVisible();

    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(
      page.getByRole("heading", { name: "Bookings", exact: true })
    ).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(
      page.getByRole("heading", { name: "Bookings", exact: true })
    ).toBeVisible();

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/login?returnUrl=/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});
