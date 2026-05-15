import { loginAsDemoHost } from "./support/auth";
import {
  cleanupEventTypesBySlug,
  createE2EAdminClient,
  uniqueE2EId,
} from "./support/db";
import { allowBrowserConsoleErrors, expect, test } from "./support/test";

test.describe("event type management", () => {
  // Exercises the complete host event type lifecycle and verifies public
  // visibility follows the active/paused state.
  test("host validates, creates, edits, pauses, and deletes an event type", async ({
    page,
  }) => {
    const adminClient = createE2EAdminClient();
    const slug = uniqueE2EId("crud");
    const title = `E2E Strategy Session ${slug.slice(-8)}`;
    const updatedTitle = `${title} Updated`;

    await cleanupEventTypesBySlug(adminClient, [slug]);

    try {
      await loginAsDemoHost(page, "/event-types/new");

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Title is required")).toBeVisible();
      await expect(page.getByText("URL slug is required")).toBeVisible();

      await page.getByLabel("Title").fill(title);
      await page.getByLabel("URL Slug").fill(slug);
      await page
        .getByLabel("Description")
        .fill("A deterministic event type created by Playwright.");
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page).toHaveURL(/\/event-types$/);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.getByText(`/${slug}`)).toBeVisible();

      await page.reload();
      await expect(page.getByRole("heading", { name: title })).toBeVisible();

      await page.goto(`/demo/${slug}`);
      await expect(
        page.getByRole("heading", { name: title })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Select a date" })
      ).toBeVisible();

      await page.goto("/event-types");
      await page.getByRole("button", { name: `Edit ${title}` }).click();
      await expect(
        page.getByRole("heading", { name: "Edit event type" })
      ).toBeVisible();
      await page.getByLabel("Title").fill(updatedTitle);
      await page
        .getByRole("switch", { name: "Visible to guests" })
        .click();
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page).toHaveURL(/\/event-types$/);
      await expect(
        page.getByRole("heading", { name: updatedTitle })
      ).toBeVisible();
      await expect(page.getByText("Paused").first()).toBeVisible();

      allowBrowserConsoleErrors(page, [
        /Failed to load resource: the server responded with a status of 404/,
      ]);
      await page.goto(`/demo/${slug}`);
      await expect(page.locator("body")).toContainText(
        "This page could not be found"
      );

      await page.goto("/event-types");
      await page
        .getByRole("button", { name: `More options for ${updatedTitle}` })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();

      const dialog = page.getByRole("dialog", { name: "Delete event type" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(updatedTitle)).toBeVisible();
      await dialog.getByRole("button", { name: "Delete" }).click();

      await expect(
        page.getByRole("button", { name: `Edit ${updatedTitle}` })
      ).toBeHidden();
    } finally {
      await cleanupEventTypesBySlug(adminClient, [slug]);
    }
  });

  // Verifies list search and status filters return useful empty states and can
  // be cleared back to the seeded event types.
  test("event type search and status filters show meaningful empty states", async ({
    page,
  }) => {
    await loginAsDemoHost(page, "/event-types");

    await page.getByLabel("Search event types").fill("not a real event type");
    await expect(page.getByText("No matching event types")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();

    await page.getByRole("button", { name: "Paused" }).click();
    await expect(page.getByText("No matching event types")).toBeVisible();
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("30 Minute Meeting")).toBeVisible();
    await expect(page.getByText("60 Minute Consultation")).toBeVisible();
  });
});
