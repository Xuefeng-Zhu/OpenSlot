export function getBookingMutationErrorStatus(error?: string): number {
  if (!error) return 500

  if (error.includes('not found') || error.includes('already used')) {
    return 404
  }
  if (error.includes('expired')) {
    return 410
  }
  if (error.includes('validation')) {
    return 400
  }
  if (
    error.includes('booked by someone else') ||
    error.includes('slot taken') ||
    error.includes('does not match') ||
    error.includes('conflicts with a connected calendar event')
  ) {
    return 409
  }
  if (error.includes('Could not verify connected calendar availability')) {
    return 503
  }

  return 500
}

export function getBookingCancellationErrorStatus(error?: string): number {
  if (!error) return 500

  if (error.includes('not found')) {
    return 404
  }
  if (error.includes('already been cancelled')) {
    return 409
  }
  if (error.includes('rescheduled')) {
    return 409
  }

  return 500
}
