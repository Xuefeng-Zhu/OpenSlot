const bookingDateOptions: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
};

const bookingTimeOptions: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

export function formatBookingDate(
  isoString: string,
  timezone?: string | null
): string {
  return new Date(isoString).toLocaleDateString([], {
    ...bookingDateOptions,
    timeZone: timezone || undefined,
  });
}

export function formatBookingTime(
  isoString: string,
  timezone?: string | null
): string {
  return new Date(isoString).toLocaleTimeString([], {
    ...bookingTimeOptions,
    timeZone: timezone || undefined,
  });
}
