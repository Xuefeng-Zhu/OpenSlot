import { expect, test } from "./support/test";

test.describe("public edge cases", () => {
  test("invalid guest action links fail safely", async ({ page }) => {
    await page.goto("/booking/cancel/not-a-valid-token");
    await expect(
      page.getByRole("heading", { name: "Invalid Cancellation Link" })
    ).toBeVisible();
    await expect(page.getByText("This cancellation link is no longer valid."))
      .toBeVisible();

    await page.goto(
      "/booking/reschedule/33333333-3333-4333-8333-333333333333"
    );
    await expect(page.locator("body")).toContainText(
      "This page could not be found"
    );
  });
});
