import { describe, expect, it } from 'vitest'
import {
  getBookingCancellationErrorStatus,
  getBookingMutationErrorStatus,
} from '../error-status'

describe('booking API error status mapping', () => {
  it.each([
    [undefined, 500],
    ['Booking not found', 404],
    ['Hold token already used', 404],
    ['Hold has expired. Please select a new slot.', 410],
    ['Request validation failed', 400],
    ['This slot was booked by someone else.', 409],
    ['slot taken', 409],
    ['Hold does not match the requested booking.', 409],
    ['The booking conflicts with a connected calendar event.', 409],
    ['Could not verify connected calendar availability', 503],
    ['Unexpected backend response', 500],
  ])('maps mutation error %j to %i', (error, status) => {
    expect(getBookingMutationErrorStatus(error)).toBe(status)
  })

  it.each([
    [undefined, 500],
    ['Booking not found', 404],
    ['Booking has already been cancelled', 409],
    ['Failed to cancel booking', 500],
    ['Unexpected backend response', 500],
  ])('maps cancellation error %j to %i', (error, status) => {
    expect(getBookingCancellationErrorStatus(error)).toBe(status)
  })
})
