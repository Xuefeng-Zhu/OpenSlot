export function formatDashboardBookingDate(
  startAt: string,
  now = new Date()
): string {
  const date = new Date(startAt);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDashboardBookingTime(startAt: string): string {
  return new Date(startAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDashboardBookingDuration(
  startAt: string,
  endAt: string
): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);

  return `${minutes} min`;
}
