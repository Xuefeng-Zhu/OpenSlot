import { loginAsDemoHost } from "./support/auth";
import { expect, test } from "./support/test";

// This file is intentionally last so invalidating the shared demo session does
// not disrupt other authenticated browser checks.
test("account menu signs out once and protects the dashboard", async ({ page }) => {
  await loginAsDemoHost(page, "/dashboard");

  let logoutRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.url().includes("/api/auth/logout") &&
      request.method() === "POST"
    ) {
      logoutRequestCount += 1;
    }
  });

  await page
    .getByRole("button", { name: "Open account menu for Demo User" })
    .click();

  const logoutResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/logout") &&
      response.request().method() === "POST"
  );
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  const logoutResponse = await logoutResponsePromise;
  expect(logoutResponse.ok()).toBe(true);
  await expect(page).toHaveURL(/\/login$/);
  expect(logoutRequestCount).toBe(1);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
});
