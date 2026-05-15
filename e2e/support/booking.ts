import { type APIRequestContext, type Page } from "@playwright/test";
import { expect } from "./test";
import type { CreatedEventType, TimeSlot } from "./db";

export interface AvailableSlot extends TimeSlot {
  date: string;
  label: string;
}

export async function findFirstAvailableSlot(
  request: APIRequestContext,
  eventType: CreatedEventType,
  timezone = "UTC"
): Promise<AvailableSlot> {
  for (let offset = 1; offset <= 45; offset += 1) {
    const date = formatDateYmd(addDays(new Date(), offset));
    const response = await request.get("/api/slots", {
      params: {
        hostUserId: eventType.profile.id,
        eventTypeId: eventType.id,
        date,
        timezone,
      },
    });

    if (!response.ok()) {
      throw new Error(
        `Slot lookup failed for ${date}: ${response.status()} ${await response.text()}`
      );
    }

    const body = (await response.json()) as { slots?: TimeSlot[] };
    const slot = body.slots?.[0];

    if (slot) {
      return {
        ...slot,
        date,
        label: formatSlotLabel(slot.start, timezone),
      };
    }
  }

  throw new Error("No available E2E slot found in the next 45 days.");
}

export async function selectBookingDate(page: Page, dateYmd: string) {
  const date = dateFromYmd(dateYmd);
  const monthHeading = date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  for (let attempt = 0; attempt < 14; attempt += 1) {
    if (await page.getByText(monthHeading).first().isVisible()) {
      break;
    }

    await page.getByRole("button", { name: "Go to the Next Month" }).click();
  }

  await expect(page.getByText(monthHeading).first()).toBeVisible();

  await page
    .getByRole("button", { name: calendarDayName(date) })
    .click();
}

export function formatDateYmd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dateFromYmd(dateYmd: string): Date {
  const [year, month, day] = dateYmd.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatSlotLabel(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function calendarDayName(date: Date): RegExp {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();

  return new RegExp(`^${weekday}, ${month} ${day}(st|nd|rd|th), ${year}`);
}
