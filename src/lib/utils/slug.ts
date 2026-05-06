/**
 * Generates a URL-safe slug from a title string.
 *
 * - Converts to lowercase
 * - Replaces spaces and non-alphanumeric characters with hyphens
 * - Removes consecutive hyphens
 * - Trims leading/trailing hyphens
 * - Returns 'untitled' if the result would be empty
 */
export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'untitled'
}
