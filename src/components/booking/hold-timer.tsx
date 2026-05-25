/**
 * Computes the remaining seconds until expiration.
 * Returns max(0, floor((expiresAt - now) / 1000))
 */
export function computeRemainingSeconds(expiresAt: string, now: Date): number {
  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000)
  );
}

/**
 * Formats seconds into a display string.
 * If >= 60 seconds, displays as "M:SS" (e.g., "2:05").
 * If < 60 seconds, displays as "0:SS" (e.g., "0:42").
 */
export function formatRemainingSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
