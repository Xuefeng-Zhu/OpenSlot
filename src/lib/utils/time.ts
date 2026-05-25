/**
 * Normalize a database time value for an HTML time input.
 *
 * Postgres time columns commonly arrive as HH:mm:ss, while browser time inputs
 * in this app store HH:mm. Keeping this conversion shared avoids small
 * server/client formatting drift in availability forms.
 */
export function toTimeInputValue(
  time: string | null | undefined
): string | null {
  return time ? time.slice(0, 5) : null
}

/**
 * Normalize a database date value for an HTML date input and date-only UI.
 *
 * Butterbase/Postgres date columns can be returned as YYYY-MM-DD or as a full
 * ISO date-time string depending on the API path. The availability editor keeps
 * override dates as date-only strings so rendering does not accidentally append
 * a second time suffix.
 */
export function toDateInputValue(
  date: string | null | undefined
): string | null {
  return date ? date.slice(0, 10) : null
}
