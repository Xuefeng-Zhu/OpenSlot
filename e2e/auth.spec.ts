import { demoHost } from "./demo-data";
import { loginAsDemoHost } from "./support/auth";
import { allowBrowserConsoleErrors, expect, test } from "./support/test";

const protectedRoutes = [
  { path: "/dashboard", expectedUrl: /\/login\?returnUrl=%2Fdashboard$/ },
  { path: "/event-types", expectedUrl: /\/login$/ },
  { path: "/availability", expectedUrl: /\/login$/ },
  { path: "/bookings", expectedUrl: /\/login$/ },
  { path: "/contacts", expectedUrl: /\/login$/ },
  { path: "/profile", expectedUrl: /\/login$/ },
  { path: "/settings", expectedUrl: /\/login$/ },
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

  // Exercises the full sign-in journey: validation, rejected credentials,
  // returnUrl routing, and session persistence after reload.
  test("login validates fields, rejects bad credentials, and persists a session", async ({
    page,
  }) => {
    await page.goto("/login?returnUrl=/bookings");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();

    await page.getByLabel("Email").fill(demoHost.email);
    await page.getByLabel("Password").fill("not-the-demo-password");
    allowBrowserConsoleErrors(page, [
      /Failed to load resource: the server responded with a status of 400/,
    ]);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(
      page.getByText("We could not sign you in. Check your email and password.")
    ).toBeVisible();

    await page.getByLabel("Password").fill(demoHost.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(
      page.getByRole("button", { name: "View booking with Jane Guest" })
    ).toBeVisible();
  });

  test("demo host can deep-link through login returnUrl", async ({ page }) => {
    await loginAsDemoHost(page, "/event-types");

    await expect(
      page.getByRole("heading", { name: "Event types" })
    ).toBeVisible();
    await expect(page.getByText("30 Minute Meeting")).toBeVisible();
  });
});
