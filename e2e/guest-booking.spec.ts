import { loginAsDemoHost } from "./support/auth";
import {
  cleanupEventType,
  createE2EAdminClient,
  createEventType,
  createSlotHold,
  uniqueE2EId,
} from "./support/db";
import {
  findFirstAvailableSlot,
  selectBookingDate,
} from "./support/booking";
import { allowBrowserConsoleErrors, expect, test } from "./support/test";

test.describe("guest booking flow", () => {
  // Runs the primary guest booking journey end to end, then verifies the host
  // can find the newly confirmed booking in the dashboard.
  test("guest validates and confirms a real booking, then host can find it", async ({
    page,
    request,
  }) => {
    const adminClient = createE2EAdminClient();
    const eventType = await createEventType(adminClient, {
      title: `E2E Guest Booking ${uniqueE2EId("slot").slice(-8)}`,
      duration_minutes: 30,
    });
    const slot = await findFirstAvailableSlot(request, eventType);
    const guestName = `E2E Guest ${uniqueE2EId("guest").slice(-6)}`;
    const guestEmail = `${uniqueE2EId("guest")}@example.com`;

    try {
      await page.goto(`/demo/${eventType.slug}`);
      await expect(
        page.getByRole("heading", { name: eventType.title })
      ).toBeVisible();

      await selectBookingDate(page, slot.date);
      await expect(page.getByRole("button", { name: slot.label })).toBeVisible();
      await page.getByRole("button", { name: slot.label }).first().click();

      await expect(
        page.getByRole("heading", { name: "Confirm your booking" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Confirm Booking" }).click();
      await expect(page.getByText("Name is required")).toBeVisible();
      await expect(page.getByText("Must be a valid email address")).toBeVisible();

      await page
        .getByRole("textbox", { name: "Name *", exact: true })
        .fill(guestName);
      await page
        .getByRole("textbox", { name: "Email *", exact: true })
        .fill(guestEmail);
      await page
        .getByLabel("Notes (optional)")
        .fill("Please include the agenda in the invite.");
      await page.getByRole("button", { name: "Confirm Booking" }).click();

      await expect(
        page.getByRole("heading", { name: "Booking confirmed" })
      ).toBeVisible();
      await expect(page.getByText(eventType.title)).toBeVisible();
      await expect(page.getByText(guestName)).toBeVisible();
      await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Need to cancel?" })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Need to reschedule?" })
      ).toBeVisible();

      await loginAsDemoHost(page, "/bookings");
      await page.getByLabel("Filter by event type").fill(eventType.title);
      const guestBooking = page.getByRole("button", {
        name: `View booking with ${guestName}`,
      });
      await expect(guestBooking).toBeVisible();
      await guestBooking.click();

      const dialog = page.getByRole("dialog", { name: "Booking Details" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(guestName)).toBeVisible();
      await expect(dialog.getByText(guestEmail).first()).toBeVisible();
      await expect(dialog.getByText(eventType.title)).toBeVisible();
      await expect(dialog.getByText("America/New_York")).toBeVisible();
    } finally {
      await cleanupEventType(adminClient, eventType.id);
    }
  });

  test("guest answers configured invitee questions during booking", async ({
    page,
    request,
  }) => {
    const adminClient = createE2EAdminClient();
    const eventType = await createEventType(adminClient, {
      title: `E2E Invitee Questions ${uniqueE2EId("questions").slice(-8)}`,
      duration_minutes: 30,
      invitee_questions: [
        {
          id: "company",
          label: "Company name",
          type: "text",
          required: true,
          options: [],
        },
        {
          id: "topic",
          label: "What should we cover?",
          type: "textarea",
          required: true,
          options: [],
        },
        {
          id: "meeting-type",
          label: "Meeting type",
          type: "select",
          required: true,
          options: ["Discovery", "Support"],
        },
        {
          id: "recording-consent",
          label: "I agree to a recording if needed",
          type: "checkbox",
          required: false,
          options: [],
        },
      ],
    });
    const slot = await findFirstAvailableSlot(request, eventType);
    const guestName = `E2E Questions ${uniqueE2EId("guest").slice(-6)}`;
    const guestEmail = `${uniqueE2EId("answers")}@example.com`;

    try {
      await page.goto(`/demo/${eventType.slug}`);
      await selectBookingDate(page, slot.date);
      await page.getByRole("button", { name: slot.label }).first().click();

      await expect(
        page.getByRole("heading", { name: "Confirm your booking" })
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Name *", exact: true })
        .fill(guestName);
      await page
        .getByRole("textbox", { name: "Email *", exact: true })
        .fill(guestEmail);
      await page.getByLabel("Company name *").fill("Codex QA Labs");
      await page
        .getByLabel("What should we cover? *")
        .fill("Structured invitee questions from the public booking page.");
      await page.getByLabel("Meeting type *").click();
      await page.getByRole("option", { name: "Discovery" }).click();
      await page.getByLabel("I agree to a recording if needed").check();
      await page.getByRole("button", { name: "Confirm Booking" }).click();

      await expect(
        page.getByRole("heading", { name: "Booking confirmed" })
      ).toBeVisible();

      const { data, error } = await adminClient
        .from("bookings")
        .select("booking_answers")
        .eq("event_type_id", eventType.id)
        .eq("guest_email", guestEmail)
        .single();

      if (error || !data) {
        throw new Error(
          `Could not verify invitee answers: ${error?.message ?? "missing row"}`
        );
      }

      expect(data.booking_answers).toEqual([
        {
          questionId: "company",
          label: "Company name",
          type: "text",
          required: true,
          value: "Codex QA Labs",
        },
        {
          questionId: "topic",
          label: "What should we cover?",
          type: "textarea",
          required: true,
          value: "Structured invitee questions from the public booking page.",
        },
        {
          questionId: "meeting-type",
          label: "Meeting type",
          type: "select",
          required: true,
          value: "Discovery",
        },
        {
          questionId: "recording-consent",
          label: "I agree to a recording if needed",
          type: "checkbox",
          required: false,
          value: true,
        },
      ]);
    } finally {
      await cleanupEventType(adminClient, eventType.id);
    }
  });

  // Simulates another guest taking the selected slot before click time and
  // verifies the stale selection is rejected without creating a booking.
  test("stale slot selection reports a conflict without creating a booking", async ({
    page,
    request,
  }) => {
    const adminClient = createE2EAdminClient();
    const eventType = await createEventType(adminClient, {
      title: `E2E Slot Conflict ${uniqueE2EId("slot").slice(-8)}`,
      duration_minutes: 30,
    });
    const slot = await findFirstAvailableSlot(request, eventType);

    try {
      await page.goto(`/demo/${eventType.slug}`);
      await selectBookingDate(page, slot.date);
      await expect(page.getByRole("button", { name: slot.label })).toBeVisible();

      await createSlotHold(adminClient, {
        eventType,
        slot,
        guestEmail: `${uniqueE2EId("race")}@example.com`,
      });

      allowBrowserConsoleErrors(page, [
        /Failed to load resource: the server responded with a status of 409/,
      ]);
      const holdResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/holds") &&
          response.request().method() === "POST"
      );
      await page.getByRole("button", { name: slot.label }).first().click();
      const holdResponse = await holdResponsePromise;
      expect(holdResponse.status()).toBe(409);
      await expect(
        page.getByText(
          "This slot has been taken by another guest. Please select a different time."
        )
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Confirm your booking" })
      ).toBeHidden();

      const { count, error } = await adminClient
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("event_type_id", eventType.id);

      if (error) {
        throw new Error(`Could not count conflict bookings: ${error.message}`);
      }

      expect(count).toBe(0);
    } finally {
      await cleanupEventType(adminClient, eventType.id);
    }
  });
});
