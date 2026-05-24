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
