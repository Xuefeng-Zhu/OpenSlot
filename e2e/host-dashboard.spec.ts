import { loginAsDemoHost } from "./support/auth";
import {
  cleanupEventType,
  cleanupWebhookEndpointByUrl,
  createConfirmedBooking,
  createE2EAdminClient,
  createEventType,
  restoreAvailability,
  restoreDemoState,
  snapshotAvailability,
  snapshotDemoState,
  uniqueE2EId,
} from "./support/db";
import {
  addDays,
  findFirstAvailableSlot,
  formatDateYmd,
} from "./support/booking";
import { expect, test } from "./support/test";

test.describe("host dashboard workflows", () => {
  test("host filters, opens, and cancels an isolated booking", async ({
    page,
    request,
  }) => {
    const adminClient = createE2EAdminClient();
    const eventType = await createEventType(adminClient, {
      title: `E2E Host Booking ${uniqueE2EId("booking").slice(-8)}`,
    });
    const slot = await findFirstAvailableSlot(request, eventType);
    const guestName = `E2E Cancel ${uniqueE2EId("guest").slice(-6)}`;
    const guestEmail = `${uniqueE2EId("cancel")}@example.com`;
    const booking = await createConfirmedBooking(adminClient, {
      eventType,
      guestName,
      guestEmail,
      startAt: slot.start,
      endAt: slot.end,
    });

    try {
      await loginAsDemoHost(page, "/bookings");
      await page.getByLabel("Filter by event type").fill(eventType.title);

      const bookingRow = page.getByRole("button", {
        name: `View booking with ${guestName}`,
      });
      await expect(bookingRow).toBeVisible();
      await bookingRow.click();

      const details = page.getByRole("dialog", { name: "Booking Details" });
      await expect(details).toBeVisible();
      await expect(details.getByText(guestEmail).first()).toBeVisible();
      await expect(details.getByText(eventType.title)).toBeVisible();

      await details.getByRole("button", { name: "Cancel booking" }).click();
      const cancelDialog = page.getByRole("dialog", { name: "Cancel Booking" });
      await expect(cancelDialog).toBeVisible();
      await cancelDialog
        .getByLabel("Reason (optional)")
        .fill("E2E host cancellation regression check.");
      await cancelDialog
        .getByRole("button", { name: "Confirm cancellation" })
        .click();

      await expect(page.getByText("Booking cancelled")).toBeVisible();
      await page.getByRole("tab", { name: /Cancelled/ }).click();
      await expect(
        page.getByRole("button", { name: `View booking with ${guestName}` })
      ).toBeVisible();
      await expect(page.getByText("Cancelled").first()).toBeVisible();

      const { data, error } = await adminClient
        .from("bookings")
        .select("status, cancel_reason")
        .eq("id", booking.id)
        .single();

      if (error || !data) {
        throw new Error(
          `Could not verify cancelled booking: ${error?.message ?? "missing row"}`
        );
      }

      expect(data.status).toBe("cancelled");
      expect(data.cancel_reason).toBe("E2E host cancellation regression check.");
    } finally {
      await cleanupEventType(adminClient, eventType.id);
    }
  });

  test("contacts search and profile history reflect booked guests", async ({
    page,
    request,
  }) => {
    const adminClient = createE2EAdminClient();
    const eventType = await createEventType(adminClient, {
      title: `E2E Contact Meeting ${uniqueE2EId("contact").slice(-8)}`,
    });
    const slot = await findFirstAvailableSlot(request, eventType);
    const guestName = `E2E Contact ${uniqueE2EId("guest").slice(-6)}`;
    const guestEmail = `${uniqueE2EId("contact")}@example.com`;

    await createConfirmedBooking(adminClient, {
      eventType,
      guestName,
      guestEmail,
      startAt: slot.start,
      endAt: slot.end,
      notes: "Contact timeline note from E2E.",
    });

    try {
      await loginAsDemoHost(page, "/contacts");
      await page.getByLabel("Search contacts").fill("no matching contact");
      await expect(page.getByText("No contacts found")).toBeVisible();

      await page.getByLabel("Search contacts").fill(guestEmail);
      await expect(page.getByText(guestName)).toBeVisible();
      await expect(page.getByText(guestEmail)).toBeVisible();

      await page.getByRole("link", { name: /View/ }).click();
      await expect(
        page.getByRole("heading", { name: guestName })
      ).toBeVisible();
      await expect(page.getByText("Meeting History")).toBeVisible();
      await expect(page.getByText(eventType.title)).toBeVisible();
      await expect(page.getByText("Contact timeline note from E2E.")).toBeVisible();
    } finally {
      await cleanupEventType(adminClient, eventType.id);
    }
  });

  test("availability validates intervals, supports discard, and persists overrides", async ({
    page,
  }) => {
    const adminClient = createE2EAdminClient();
    const snapshot = await snapshotAvailability(adminClient);
    const overrideDate = formatDateYmd(addDays(new Date(), 21));
    const reason = `E2E unavailable ${uniqueE2EId("availability").slice(-6)}`;

    try {
      await loginAsDemoHost(page, "/availability");

      await page
        .getByRole("button", { name: "Add interval for Monday" })
        .click();
      await page
        .getByLabel("Start time for Monday interval 2")
        .fill("15:00");
      await page.getByLabel("End time for Monday interval 2").fill("14:00");
      await expect(
        page.getByText("End time must be after start time")
      ).toBeVisible();
      await expect(page.getByText("You have unsaved changes.")).toBeVisible();
      await page.getByRole("button", { name: "Discard" }).click();
      await expect(
        page.getByText("End time must be after start time")
      ).toBeHidden();

      await page.getByLabel("Date").fill(overrideDate);
      await page.getByLabel("Reason (optional)").fill(reason);
      await page.getByRole("button", { name: "Add override" }).click();
      await expect(page.getByText(reason)).toBeVisible();
      await page.getByRole("button", { name: "Save availability" }).click();
      await expect(page.getByText("Availability saved")).toBeVisible();

      await page.reload();
      await expect(page.getByText(reason)).toBeVisible();
    } finally {
      await restoreAvailability(adminClient, snapshot);
    }
  });

  test("profile and display preferences persist and can be restored", async ({
    page,
  }) => {
    const adminClient = createE2EAdminClient();
    const snapshot = await snapshotDemoState(adminClient);
    const nextName = `Demo User E2E ${uniqueE2EId("profile").slice(-4)}`;

    try {
      await loginAsDemoHost(page, "/profile");
      await page.getByLabel("Name").fill(nextName);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Profile updated successfully.")).toBeVisible();

      await page.goto("/demo");
      await expect(page.getByRole("heading", { name: nextName })).toBeVisible();

      await page.goto("/settings");
      await page.getByRole("tab", { name: "Preferences" }).click();
      await page.getByLabel("Date format").selectOption("YYYY-MM-DD");
      await page.getByLabel("Time format").selectOption("24h");
      await page.getByRole("button", { name: "Save preferences" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      await page.reload();
      await page.getByRole("tab", { name: "Preferences" }).click();
      await expect(page.getByLabel("Date format")).toHaveValue("YYYY-MM-DD");
      await expect(page.getByLabel("Time format")).toHaveValue("24h");
    } finally {
      await restoreDemoState(adminClient, snapshot);
    }
  });

  test("settings can create, pause, enable, and delete a webhook endpoint", async ({
    page,
  }) => {
    const adminClient = createE2EAdminClient();
    const endpointUrl = `https://example.com/e2e/${uniqueE2EId("webhook")}`;

    await cleanupWebhookEndpointByUrl(adminClient, endpointUrl);

    try {
      page.on("dialog", (dialog) => dialog.accept());

      await loginAsDemoHost(page, "/settings");
      await page.getByRole("tab", { name: "Integrations" }).click();
      await page.getByLabel("Endpoint URL").fill("not-a-url");
      await page.getByRole("button", { name: "Add endpoint" }).click();
      await expect(page.getByText("Webhook not created")).toBeVisible();

      await page.getByLabel("Endpoint URL").fill(endpointUrl);
      await page
        .getByLabel("Description")
        .fill("E2E webhook endpoint");
      await page.getByLabel("Cancelled").check();
      await page.getByRole("button", { name: "Add endpoint" }).click();

      await expect(page.getByText("Webhook created")).toBeVisible();
      await expect(page.getByLabel("Signing secret")).toBeVisible();
      await expect(page.getByText(endpointUrl)).toBeVisible();
      await expect(page.getByText("Active").first()).toBeVisible();

      await page.getByRole("button", { name: "Pause" }).click();
      await expect(page.getByText("Paused").first()).toBeVisible();
      await page.getByRole("button", { name: "Enable" }).click();
      await expect(page.getByText("Active").first()).toBeVisible();

      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByText(endpointUrl)).toBeHidden();
      await expect(
        page.getByText("No webhook endpoints configured.")
      ).toBeVisible();
    } finally {
      await cleanupWebhookEndpointByUrl(adminClient, endpointUrl);
    }
  });

  test("mobile dashboard navigation opens primary pages", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDemoHost(page, "/dashboard");

    await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Bookings" })
      .click();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Settings" })
      .click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});
