import { loginAsDemoHost } from "./support/auth";
import { expect, test } from "./support/test";

test.describe("onboarding wizard", () => {
  test("validates each step without submitting seeded host data", async ({
    page,
  }) => {
    await loginAsDemoHost(page, "/onboarding");

    await expect(
      page.getByRole("heading", { name: "Create your public profile" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByText("Enter the display name people will see.")
    ).toBeVisible();
    await expect(
      page.getByText("Choose a username for your booking link.")
    ).toBeVisible();

    await page.getByLabel("Display name").fill("E2E Onboarding");
    await page.getByLabel("Username").fill("Invalid Username");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByText("Use lowercase letters, numbers, and hyphens.")
    ).toBeVisible();

    await page.getByLabel("Username").fill("e2e-onboarding");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Set your availability" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Create your first event type" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(
      page.getByText("Enter a title for this event type.")
    ).toBeVisible();
    await expect(
      page.getByText("Enter where this meeting will happen.")
    ).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(
      page.getByRole("heading", { name: "Set your availability" })
    ).toBeVisible();
  });
});
