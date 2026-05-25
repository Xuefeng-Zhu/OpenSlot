import type { Page } from "@playwright/test";
import { loginAsDemoHost } from "./support/auth";
import { addDays, formatDateYmd } from "./support/booking";
import {
  cleanupEventTypesBySlug,
  createEventType,
  createE2EAdminClient,
  getDemoProfile,
  uniqueE2EId,
} from "./support/db";
import { allowBrowserConsoleErrors, expect, test } from "./support/test";

test.describe("event type management", () => {
  // Covers the complete event type lifecycle, including public visibility after
  // create, persistence after reload, pausing, and deletion.
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
      await fillManualLocation(page, slug);
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page).toHaveURL(/\/event-types$/);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.getByText(`/${slug}`)).toBeVisible();

      await page.reload();
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      const eventTypeId = await eventTypeIdBySlug(adminClient, slug);

      await page.goto(`/demo/${slug}`);
      await expect(
        page.getByRole("heading", { name: title })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Select a date" })
      ).toBeVisible();

      await page.goto(`/event-types/${eventTypeId}/edit`);
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

  test("host configures a pre-meeting reminder for an event type", async ({
    page,
  }) => {
    const adminClient = createE2EAdminClient();
    const slug = uniqueE2EId("reminder");
    const title = `E2E Reminder Session ${slug.slice(-8)}`;

    await cleanupEventTypesBySlug(adminClient, [slug]);

    try {
      await loginAsDemoHost(page, "/event-types/new");

      await page.getByLabel("Title").fill(title);
      await page.getByLabel("URL Slug").fill(slug);
      await fillManualLocation(page, slug);
      await page.getByRole("button", { name: "Reminders" }).click();
      await page
        .getByRole("switch", { name: "Enable pre-meeting reminders" })
        .click();
      await page.getByLabel("Send before start (minutes)").fill("90");
      await page
        .getByRole("switch", { name: "Email host reminders" })
        .click();
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page).toHaveURL(/\/event-types$/);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();

      await expect
        .poll(async () => {
          const { data } = await adminClient
            .from("event_types")
            .select(
              "reminder_enabled, reminder_minutes_before, reminder_guest_enabled, reminder_host_enabled"
            )
            .eq("slug", slug)
            .single();

          return data;
        })
        .toMatchObject({
          reminder_enabled: true,
          reminder_minutes_before: 90,
          reminder_guest_enabled: true,
          reminder_host_enabled: false,
        });

      const eventTypeId = await eventTypeIdBySlug(adminClient, slug);
      await page.goto(`/event-types/${eventTypeId}/edit`);
      await page.getByRole("button", { name: "Reminders" }).click();

      await expect(
        page.getByRole("switch", { name: "Enable pre-meeting reminders" })
      ).toHaveAttribute("aria-checked", "true");
      await expect(page.getByLabel("Send before start (minutes)")).toHaveValue(
        "90"
      );
      await expect(
        page.getByRole("switch", { name: "Email guest reminders" })
      ).toHaveAttribute("aria-checked", "true");
      await expect(
        page.getByRole("switch", { name: "Email host reminders" })
      ).toHaveAttribute("aria-checked", "false");
    } finally {
      await cleanupEventTypesBySlug(adminClient, [slug]);
    }
  });

  test("event types can use different availability schedules", async ({
    page,
  }) => {
    const adminClient = createE2EAdminClient();
    const profile = await getDemoProfile(adminClient);
    const slug = uniqueE2EId("schedule");
    const defaultSlug = uniqueE2EId("schedule-default");
    const title = `E2E Schedule Session ${slug.slice(-8)}`;
    const defaultTitle = `E2E Default Schedule Session ${defaultSlug.slice(-8)}`;
    const scheduleName = `E2E Afternoon ${slug.slice(-6)}`;
    const duplicatedScheduleName = `E2E Copy ${slug.slice(-6)}`;
    const date = nextWeekdayDate(1, 14);

    await cleanupEventTypesBySlug(adminClient, [slug, defaultSlug]);
    await adminClient
      .from("schedules")
      .delete()
      .eq("user_id", profile.id)
      .in("name", [scheduleName, duplicatedScheduleName]);
    const defaultEventType = await createEventType(adminClient, {
      slug: defaultSlug,
      title: defaultTitle,
    });

    try {
      await loginAsDemoHost(page, "/availability");

      await page.getByRole("button", { name: "Active schedule" }).click();
      await page.getByRole("menuitem", { name: "Create schedule" }).click();
      await page.getByLabel("New schedule").fill(scheduleName);
      await page.getByRole("button", { name: "Create schedule" }).click();
      await expect(
        page.getByText("Schedule created", { exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Active schedule" })
      ).toContainText(scheduleName);

      await page
        .getByRole("switch", { name: "Toggle Monday availability" })
        .click();
      await page
        .getByRole("button", { name: "Add interval for Monday" })
        .click();
      await page.getByLabel("Start time for Monday interval 1").fill("13:00");
      await page.getByLabel("End time for Monday interval 1").fill("13:30");
      await page.getByRole("button", { name: "Save availability" }).click();
      await expect(
        page.getByText("Availability saved", { exact: true })
      ).toBeVisible();

      await page.getByRole("button", { name: "Schedule actions" }).click();
      await page.getByRole("menuitem", { name: "Duplicate" }).click();
      await page.getByLabel("Schedule name").fill(duplicatedScheduleName);
      await page.getByRole("button", { name: "Duplicate" }).click();
      await expect(
        page.getByText("Schedule duplicated", { exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Active schedule" })
      ).toContainText(duplicatedScheduleName);
      await expect(
        page.getByLabel("Start time for Monday interval 1")
      ).toHaveValue("13:00");
      await expect(
        page.getByLabel("End time for Monday interval 1")
      ).toHaveValue("13:30");

      await page.getByRole("button", { name: "Active schedule" }).click();
      await page.getByRole("menuitem", { name: scheduleName }).click();
      await expect(
        page.getByRole("button", { name: "Active schedule" })
      ).toContainText(
        scheduleName
      );

      await page.goto("/event-types/new");
      await page.getByLabel("Title").fill(title);
      await page.getByLabel("URL Slug").fill(slug);
      await fillManualLocation(page, slug);
      await page.getByRole("button", { name: "Scheduling Limits" }).click();
      await page.getByRole("combobox", { name: "Availability schedule" }).click();
      await page.getByRole("option", { name: scheduleName }).click();
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page).toHaveURL(/\/event-types$/);

      const { data: customEventType } = await adminClient
        .from("event_types")
        .select("id")
        .eq("slug", slug)
        .single();
      const customSlots = await fetchSlotStarts(page, {
        hostUserId: profile.id,
        eventTypeId: customEventType!.id,
        date,
      });
      const defaultSlots = await fetchSlotStarts(page, {
        hostUserId: profile.id,
        eventTypeId: defaultEventType.id,
        date,
      });

      expect(slotLocalTime(customSlots[0])).toBe("1:00 PM");
      expect(slotLocalTime(defaultSlots[0])).toBe("9:00 AM");
    } finally {
      await cleanupEventTypesBySlug(adminClient, [slug, defaultSlug]);
      await adminClient
        .from("schedules")
        .delete()
        .eq("user_id", profile.id)
        .in("name", [scheduleName, duplicatedScheduleName]);
    }
  });
});

function nextWeekdayDate(weekday: number, minDaysAhead: number) {
  let date = addDays(new Date(), minDaysAhead);
  while (date.getDay() !== weekday) {
    date = addDays(date, 1);
  }

  return formatDateYmd(date);
}

async function fillManualLocation(page: Page, slug: string) {
  const locationDetails = page.getByLabel("Location details");
  if (!(await locationDetails.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Location" }).click();
  }
  await locationDetails.fill(`https://meet.example.com/${slug}`);
}

async function eventTypeIdBySlug(
  adminClient: ReturnType<typeof createE2EAdminClient>,
  slug: string
) {
  const { data, error } = await adminClient
    .from("event_types")
    .select("id")
    .eq("slug", slug)
    .single();

  expect(error).toBeNull();
  expect(data?.id).toBeTruthy();

  return data!.id as string;
}

async function fetchSlotStarts(
  page: Page,
  {
    hostUserId,
    eventTypeId,
    date,
  }: { hostUserId: string; eventTypeId: string; date: string }
) {
  const params = new URLSearchParams({
    hostUserId,
    eventTypeId,
    date,
    timezone: "America/New_York",
  });
  const response = await page.request.get(`/api/slots?${params.toString()}`);
  expect(response.ok()).toBe(true);
  const data = (await response.json()) as { slots: Array<{ start: string }> };
  return data.slots.map((slot) => slot.start);
}

function slotLocalTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}
