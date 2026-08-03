import { mkdirSync } from "node:fs";
import path from "node:path";
import { demoIds } from "./demo-data";
import { loginAsDemoHost } from "./support/auth";
import { expect, expectVisibleText, test } from "./support/test";
import type { Page } from "@playwright/test";

interface PageSmokeCase {
  name: string;
  path: string;
  title: string | RegExp;
  heading?: string | RegExp;
  visibleText?: Array<string | RegExp>;
  desktopVisibleText?: Array<string | RegExp>;
}

const qaScreenshotDirectory = process.env.QA_SCREENSHOT_DIR?.trim();
const qaScreenshotLabel = process.env.QA_SCREENSHOT_LABEL?.trim() || "qa";

const publicPageCases: PageSmokeCase[] = [
  {
    name: "landing",
    path: "/",
    title: "OpenSlot - Share availability. Book time. Stay in sync.",
    heading: "Scheduling that stays open.",
    visibleText: ["Create your OpenSlot"],
  },
  {
    name: "terms",
    path: "/terms",
    title: "Terms of Service | OpenSlot",
    heading: "Terms of Service",
    visibleText: ["Account Responsibilities"],
  },
  {
    name: "privacy",
    path: "/privacy",
    title: "Privacy Policy | OpenSlot",
    heading: "Privacy Policy",
    visibleText: ["Information We Collect"],
  },
  {
    name: "login",
    path: "/login",
    title: "Log in | OpenSlot",
    heading: "Welcome back",
    visibleText: ["Log in to manage event types"],
  },
  {
    name: "signup",
    path: "/signup",
    title: "Create account | OpenSlot",
    heading: "Create your account",
    visibleText: ["Email address", "At least 8 characters"],
  },
  {
    name: "forgot password",
    path: "/forgot-password",
    title: "Reset password | OpenSlot",
    heading: "Reset your password",
    visibleText: ["Send reset code"],
  },
  {
    name: "reset password",
    path: "/reset-password",
    title: "Choose a new password | OpenSlot",
    heading: "Choose a new password",
    visibleText: ["Reset code"],
  },
  {
    name: "public profile",
    path: "/demo",
    title: "Booking profile | OpenSlot",
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
    title: "Book a time | OpenSlot",
    heading: "30 Minute Meeting",
    visibleText: ["Demo User", "Select a date", "Available times"],
  },
  {
    name: "booking cancellation",
    path: `/booking/cancel/${demoIds.cancellationToken}`,
    title: "Cancel booking | OpenSlot",
    heading: "Cancel Booking",
    visibleText: ["Jane Guest", "30 Minute Meeting"],
  },
  {
    name: "booking reschedule",
    path: `/booking/reschedule/${demoIds.rescheduleToken}`,
    title: "Reschedule booking | OpenSlot",
    heading: "Reschedule booking",
    visibleText: ["Jane Guest", "30 Minute Meeting", "Select a date"],
  },
];

const authenticatedPageCases: PageSmokeCase[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    title: "Dashboard | OpenSlot",
    heading: "Welcome back, Demo",
    visibleText: ["Active event types", "Jane Guest", "30 Minute Meeting"],
  },
  {
    name: "onboarding",
    path: "/onboarding",
    title: "Set up OpenSlot | OpenSlot",
    heading: "Create your public profile",
    desktopVisibleText: ["Set availability", "Create first event type"],
  },
  {
    name: "availability",
    path: "/availability",
    title: "Availability | OpenSlot",
    heading: "Availability",
    visibleText: ["Weekly hours", "America/New York"],
  },
  {
    name: "settings",
    path: "/settings",
    title: "Settings | OpenSlot",
    heading: "Settings",
    visibleText: ["Sign-in email", "Integrations"],
  },
  {
    name: "profile",
    path: "/profile",
    title: "Profile | OpenSlot",
    heading: "Profile",
    visibleText: ["Control the public identity", "Edit profile"],
  },
  {
    name: "contacts",
    path: "/contacts",
    title: "Contacts | OpenSlot",
    heading: "Contacts",
    visibleText: ["Jane Guest", "jane.guest@example.com"],
  },
  {
    name: "contact profile",
    path: `/contacts/${demoIds.contact}`,
    title: "Contact details | OpenSlot",
    heading: "Jane Guest",
    visibleText: ["Meeting History", "30 Minute Meeting"],
  },
  {
    name: "event types",
    path: "/event-types",
    title: "Event types | OpenSlot",
    heading: "Event types",
    visibleText: ["30 Minute Meeting", "60 Minute Consultation"],
  },
  {
    name: "new event type",
    path: "/event-types/new",
    title: "Create event type | OpenSlot",
    heading: "Create event type",
    visibleText: ["Title", "Live preview"],
  },
  {
    name: "edit event type",
    path: `/event-types/${demoIds.eventType30Min}/edit`,
    title: "Edit event type | OpenSlot",
    heading: "Edit event type",
    visibleText: ["30 Minute Meeting", "Live preview"],
  },
  {
    name: "bookings",
    path: "/bookings",
    title: "Bookings | OpenSlot",
    heading: "Bookings",
    visibleText: ["Jane Guest", "30 Minute Meeting", "Confirmed"],
  },
];

async function expectSmokePage(page: Page, pageCase: PageSmokeCase) {
  await page.goto(pageCase.path);

  await expect(page).toHaveTitle(pageCase.title);

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

  if ((page.viewportSize()?.width ?? 0) >= 640) {
    for (const text of pageCase.desktopVisibleText ?? []) {
      await expectVisibleText(page, text);
    }
  }

  if (qaScreenshotDirectory) {
    mkdirSync(qaScreenshotDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(
        qaScreenshotDirectory,
        `${safeScreenshotName(qaScreenshotLabel)}-${safeScreenshotName(pageCase.name)}.png`
      ),
      fullPage: true,
    });
  }
}

function safeScreenshotName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

test("public and token pages render with seeded data", async ({ page }) => {
  for (const pageCase of publicPageCases) {
    await test.step(pageCase.name, async () => {
      await expectSmokePage(page, pageCase);
    });
  }
});

test("dashboard pages require authentication", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
});

test("authenticated seeded pages render", async ({ page }) => {
  test.slow();

  await loginAsDemoHost(page);

  for (const pageCase of authenticatedPageCases) {
    await test.step(pageCase.name, async () => {
      await expectSmokePage(page, pageCase);
    });
  }
});

// Exercises representative seeded dashboard interactions: filtering event
// types, navigating by sidebar, opening booking details, and closing the drawer.
test("seeded host can use dashboard page interactions", async ({ page }) => {
  await loginAsDemoHost(page);

  await expect(
    page.getByRole("heading", { name: "Welcome back, Demo" })
  ).toBeVisible();
  await expect(page.getByText("Active event types")).toBeVisible();
  await expectVisibleText(page, "Jane Guest");
  await expect(page.getByText("30 Minute Meeting")).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();

  await navigateFromDashboard(page, "Event Types");
  await expect(page).toHaveURL(/\/event-types$/);
  await expect(
    page.getByRole("heading", { name: "Event types" })
  ).toBeVisible();

  await page.getByLabel("Search event types").fill("60 Minute Consultation");
  await expect(page.getByText("60 Minute Consultation")).toBeVisible();
  await expect(page.getByText("30 Minute Meeting")).toBeHidden();
  await expect(
    page.getByText(/Showing 1 to 1 of \d+ event types/)
  ).toBeVisible();

  await navigateFromDashboard(page, "Bookings");
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

async function navigateFromDashboard(page: Page, label: string) {
  const desktopLink = page.getByRole("link", { name: label, exact: true });

  if (await desktopLink.isVisible()) {
    await desktopLink.click();
    return;
  }

  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page
    .getByRole("dialog", { name: "Navigation menu" })
    .getByRole("link", { name: label, exact: true })
    .click();
}
