import { demoIds } from "./demo-data";
import { loginAsDemoHost } from "./support/auth";
import { expect, expectVisibleText, test } from "./support/test";
import type { Page } from "@playwright/test";

interface PageSmokeCase {
  name: string;
  path: string;
  heading?: string | RegExp;
  visibleText?: Array<string | RegExp>;
}

const publicPageCases: PageSmokeCase[] = [
  {
    name: "landing",
    path: "/",
    heading: "Scheduling that stays open.",
    visibleText: ["Create your OpenSlot"],
  },
  {
    name: "terms",
    path: "/terms",
    heading: "Terms of Service",
    visibleText: ["Account Responsibilities"],
  },
  {
    name: "privacy",
    path: "/privacy",
    heading: "Privacy Policy",
    visibleText: ["Information We Collect"],
  },
  {
    name: "login",
    path: "/login",
    heading: "Welcome back",
    visibleText: ["Log in to manage event types"],
  },
  {
    name: "signup",
    path: "/signup",
    heading: "Create your account",
    visibleText: ["Email address", "At least 8 characters"],
  },
  {
    name: "forgot password",
    path: "/forgot-password",
    heading: "Reset your password",
    visibleText: ["Send reset link"],
  },
  {
    name: "reset password",
    path: "/reset-password",
    heading: "Choose a new password",
    visibleText: ["Open the password reset link from your email to continue."],
  },
  {
    name: "public profile",
    path: "/demo",
    heading: "Demo User",
    visibleText: [
      "Book time with Demo",
      "30 Minute Meeting",
      "60 Minute Consultation",
    ],
  },
  {
    name: "public event",
    path: "/demo/30-minute-meeting",
    heading: "30 Minute Meeting",
    visibleText: ["Demo User", "Select a date", "Available times"],
  },
  {
    name: "booking cancellation",
    path: `/booking/cancel/${demoIds.cancellationToken}`,
    heading: "Cancel Booking",
    visibleText: ["Jane Guest", "30 Minute Meeting"],
  },
  {
    name: "booking reschedule",
    path: `/booking/reschedule/${demoIds.rescheduleToken}`,
    heading: "Reschedule booking",
    visibleText: ["Jane Guest", "30 Minute Meeting", "Select a date"],
  },
];

const authenticatedPageCases: PageSmokeCase[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    heading: "Welcome back, Demo",
    visibleText: ["Active event types", "Jane Guest", "30 Minute Meeting"],
  },
  {
    name: "onboarding",
    path: "/onboarding",
    heading: "Create your public profile",
    visibleText: ["Set availability", "Create first event type"],
  },
  {
    name: "availability",
    path: "/availability",
    heading: "Availability",
    visibleText: ["Weekly availability", "America/New York"],
  },
  {
    name: "settings",
    path: "/settings",
    heading: "Settings",
    visibleText: ["Profile information", "Integrations"],
  },
  {
    name: "profile",
    path: "/profile",
    heading: "Profile",
    visibleText: ["Control the public name", "Edit profile"],
  },
  {
    name: "contacts",
    path: "/contacts",
    heading: "Contacts",
    visibleText: ["Jane Guest", "jane.guest@example.com"],
  },
  {
    name: "contact profile",
    path: `/contacts/${demoIds.contact}`,
    heading: "Jane Guest",
    visibleText: ["Meeting History", "30 Minute Meeting"],
  },
  {
    name: "event types",
    path: "/event-types",
    heading: "Event types",
    visibleText: ["30 Minute Meeting", "60 Minute Consultation"],
  },
  {
    name: "new event type",
    path: "/event-types/new",
    heading: "Create event type",
    visibleText: ["Title", "Live preview"],
  },
  {
    name: "edit event type",
    path: `/event-types/${demoIds.eventType30Min}/edit`,
    heading: "Edit event type",
    visibleText: ["30 Minute Meeting", "Live preview"],
  },
  {
    name: "bookings",
    path: "/bookings",
    heading: "Bookings",
    visibleText: ["Jane Guest", "30 Minute Meeting", "Confirmed"],
  },
];

async function expectSmokePage(page: Page, pageCase: PageSmokeCase) {
  await page.goto(pageCase.path);

  await expect(page.locator("body")).not.toContainText(
    "This page could not be found"
  );
  await expect(page.locator("body")).not.toContainText("Application error");

  if (pageCase.heading) {
    await expect(
      page.getByRole("heading", { name: pageCase.heading }).first()
    ).toBeVisible();
  }

  for (const text of pageCase.visibleText ?? []) {
    await expectVisibleText(page, text);
  }
}

// Smoke-checks public, auth, and guest token pages against seeded data so top
// level routes fail fast on render errors or missing critical content.
test("public and token pages render with seeded data", async ({ page }) => {
  for (const pageCase of publicPageCases) {
    await test.step(pageCase.name, async () => {
      await expectSmokePage(page, pageCase);
    });
  }
});

// Verifies the main dashboard entry point protects host-only content.
test("dashboard pages require authentication", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
});

// Smoke-checks all seeded authenticated pages after login for headings and key
// content that should be present on first render.
test("authenticated seeded pages render", async ({ page }) => {
  await loginAsDemoHost(page);

  for (const pageCase of authenticatedPageCases) {
    await test.step(pageCase.name, async () => {
      await expectSmokePage(page, pageCase);
    });
  }
});

// Exercises representative dashboard interactions: event type filtering,
// sidebar navigation, booking detail drawer open, and drawer close.
test("seeded host can use dashboard page interactions", async ({ page }) => {
  await loginAsDemoHost(page);

  await expect(
    page.getByRole("heading", { name: "Welcome back, Demo" })
  ).toBeVisible();
  await expect(page.getByText("Active event types")).toBeVisible();
  await expectVisibleText(page, "Jane Guest");
  await expect(page.getByText("30 Minute Meeting")).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();

  await page.getByRole("link", { name: "Event Types", exact: true }).click();
  await expect(page).toHaveURL(/\/event-types$/);
  await expect(
    page.getByRole("heading", { name: "Event types" })
  ).toBeVisible();

  await page.getByLabel("Search event types").fill("60 Minute Consultation");
  await expect(page.getByText("60 Minute Consultation")).toBeVisible();
  await expect(page.getByText("30 Minute Meeting")).toBeHidden();
  await expect(page.getByText("Showing 1 to 1 of 2 event types")).toBeVisible();

  await page.getByRole("link", { name: "Bookings", exact: true }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
  const janeGuestBooking = page.getByRole("button", {
    name: "View booking with Jane Guest",
  });
  await expect(janeGuestBooking).toBeVisible();
  await janeGuestBooking.click();

  const bookingDetails = page.getByRole("dialog", { name: "Booking Details" });
  await expect(bookingDetails).toBeVisible();
  await expect(bookingDetails.getByText("Jane Guest").first()).toBeVisible();
  await expect(
    bookingDetails.getByText("jane.guest@example.com").first()
  ).toBeVisible();
  await expect(bookingDetails.getByText("30 Minute Meeting")).toBeVisible();
  await expect(bookingDetails.getByText("America/Chicago")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(bookingDetails).toBeHidden();
});
