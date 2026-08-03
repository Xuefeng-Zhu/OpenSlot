export const dashboardDateFormats = [
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
] as const;

export const dashboardTimeFormats = ["12h", "24h"] as const;

export type DashboardDateFormat = (typeof dashboardDateFormats)[number];
export type DashboardTimeFormat = (typeof dashboardTimeFormats)[number];

/** Host-controlled date, time, and timezone preferences for dashboard output. */
export interface DashboardDisplayPreferences {
  timezone: string;
  dateFormat: DashboardDateFormat;
  timeFormat: DashboardTimeFormat;
}

export const defaultDashboardDisplayPreferences: DashboardDisplayPreferences = {
  timezone: "UTC",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

interface DisplayPreferenceInput {
  timezone?: string | null;
  dateFormat?: string | null;
  timeFormat?: string | null;
}

interface CalendarDateParts {
  year: string;
  month: string;
  day: string;
}

const invalidDateLabel = "—";

/**
 * Normalizes values loaded from profile/settings rows into a safe dashboard
 * preference object. Invalid timezones fall back to UTC rather than the server
 * or browser's local timezone.
 */
export function normalizeDashboardDisplayPreferences(
  input: DisplayPreferenceInput
): DashboardDisplayPreferences {
  return {
    timezone: isValidTimezone(input.timezone)
      ? input.timezone
      : defaultDashboardDisplayPreferences.timezone,
    dateFormat: dashboardDateFormats.includes(
      input.dateFormat as DashboardDateFormat
    )
      ? (input.dateFormat as DashboardDateFormat)
      : defaultDashboardDisplayPreferences.dateFormat,
    timeFormat: dashboardTimeFormats.includes(
      input.timeFormat as DashboardTimeFormat
    )
      ? (input.timeFormat as DashboardTimeFormat)
      : defaultDashboardDisplayPreferences.timeFormat,
  };
}

/** Formats an instant as the host's exact selected date representation. */
export function formatDashboardDate(
  value: string | Date,
  preferences: DashboardDisplayPreferences
): string {
  const date = toValidDate(value);
  if (!date) return invalidDateLabel;

  const safePreferences = normalizeDashboardDisplayPreferences(preferences);
  const parts = calendarDateParts(date, safePreferences.timezone);
  return parts
    ? formatCalendarDateParts(parts, safePreferences.dateFormat)
    : invalidDateLabel;
}

/**
 * Formats a database date-only value without first converting it to an instant,
 * preventing UTC or browser timezone shifts around midnight.
 */
export function formatDashboardDateOnly(
  value: string,
  preferences: DashboardDisplayPreferences
): string {
  const parts = parseDateOnly(value);
  if (!parts) return invalidDateLabel;

  const safePreferences = normalizeDashboardDisplayPreferences(preferences);
  return formatCalendarDateParts(parts, safePreferences.dateFormat);
}

/** Returns the abbreviated month for a valid date-only value without timezone conversion. */
export function formatDashboardDateOnlyMonth(value: string): string {
  const parts = parseDateOnly(value);
  if (!parts) return invalidDateLabel;

  const date = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  );
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Returns the numeric day for a valid date-only value without timezone conversion. */
export function formatDashboardDateOnlyDay(value: string): string {
  return parseDateOnly(value)?.day.replace(/^0/, "") ?? invalidDateLabel;
}

/** Formats an instant in the host's timezone using 12- or 24-hour time. */
export function formatDashboardTime(
  value: string | Date,
  preferences: DashboardDisplayPreferences
): string {
  const date = toValidDate(value);
  if (!date) return invalidDateLabel;

  const safePreferences = normalizeDashboardDisplayPreferences(preferences);

  try {
    if (safePreferences.timeFormat === "24h") {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: safePreferences.timezone,
      }).format(date);
    }

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: safePreferences.timezone,
    }).format(date);
  } catch {
    return invalidDateLabel;
  }
}

/** Formats a timezone-free HH:mm wall-clock value using the host's time preference. */
export function formatDashboardClockTime(
  value: string,
  preferences: DashboardDisplayPreferences
): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return invalidDateLabel;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return invalidDateLabel;

  const safePreferences = normalizeDashboardDisplayPreferences(preferences);
  if (safePreferences.timeFormat === "24h") {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Formats two instants as a host-local time range. */
export function formatDashboardTimeRange(
  start: string | Date,
  end: string | Date,
  preferences: DashboardDisplayPreferences
): string {
  const startLabel = formatDashboardTime(start, preferences);
  const endLabel = formatDashboardTime(end, preferences);
  if (startLabel === invalidDateLabel || endLabel === invalidDateLabel) {
    return invalidDateLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

/** Formats an instant as a host-local date and time label. */
export function formatDashboardTimestamp(
  value: string | Date,
  preferences: DashboardDisplayPreferences
): string {
  const date = formatDashboardDate(value, preferences);
  const time = formatDashboardTime(value, preferences);
  if (date === invalidDateLabel || time === invalidDateLabel) {
    return invalidDateLabel;
  }
  return `${date} · ${time}`;
}

/**
 * Uses Today/Tomorrow when the instant falls on those calendar days in the
 * host timezone; otherwise returns the host's selected date representation.
 */
export function formatDashboardRelativeDate(
  value: string | Date,
  preferences: DashboardDisplayPreferences,
  now: string | Date = new Date()
): string {
  const date = toValidDate(value);
  const current = toValidDate(now);
  if (!date || !current) return invalidDateLabel;

  const safePreferences = normalizeDashboardDisplayPreferences(preferences);
  const dateParts = calendarDateParts(date, safePreferences.timezone);
  const nowParts = calendarDateParts(current, safePreferences.timezone);
  if (!dateParts || !nowParts) return invalidDateLabel;

  const dateKey = calendarDateKey(dateParts);
  const todayKey = calendarDateKey(nowParts);
  if (dateKey === todayKey) return "Today";

  const tomorrow = new Date(
    Date.UTC(
      Number(nowParts.year),
      Number(nowParts.month) - 1,
      Number(nowParts.day) + 1
    )
  );
  const tomorrowKey = [
    tomorrow.getUTCFullYear(),
    String(tomorrow.getUTCMonth() + 1).padStart(2, "0"),
    String(tomorrow.getUTCDate()).padStart(2, "0"),
  ].join("-");

  return dateKey === tomorrowKey
    ? "Tomorrow"
    : formatCalendarDateParts(dateParts, safePreferences.dateFormat);
}

/** Returns a minute duration for valid, ordered instants. */
export function formatDashboardDuration(
  start: string | Date,
  end: string | Date
): string {
  const startDate = toValidDate(start);
  const endDate = toValidDate(end);
  if (!startDate || !endDate || endDate < startDate) return invalidDateLabel;

  return `${Math.round((endDate.getTime() - startDate.getTime()) / 60_000)} min`;
}

function isValidTimezone(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function toValidDate(value: string | Date): Date | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDateParts(
  date: Date,
  timezone: string
): CalendarDateParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((candidate) => candidate.type === type)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");
    return year && month && day ? { year, month, day } : null;
  } catch {
    return null;
  }
}

function parseDateOnly(value: string): CalendarDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return { year, month, day };
}

function formatCalendarDateParts(
  parts: CalendarDateParts,
  dateFormat: DashboardDateFormat
): string {
  if (dateFormat === "DD/MM/YYYY") {
    return `${parts.day}/${parts.month}/${parts.year}`;
  }
  if (dateFormat === "YYYY-MM-DD") {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  return `${parts.month}/${parts.day}/${parts.year}`;
}

function calendarDateKey(parts: CalendarDateParts): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}
