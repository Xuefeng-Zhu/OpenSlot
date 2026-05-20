import { zodResolver } from '@hookform/resolvers/zod'
import { describe, expect, it } from 'vitest'
import {
  createConfirmBookingFormSchema,
  type ConfirmBookingFormInputValues,
} from '@/lib/validations/booking'

describe('booking form resolver', () => {
  it('returns nested invitee question errors instead of throwing', async () => {
    const schema = createConfirmBookingFormSchema([
      {
        id: 'topic',
        label: 'What should we cover?',
        type: 'textarea',
        required: true,
        options: [],
      },
      {
        id: 'meeting-type',
        label: 'Meeting type',
        type: 'select',
        required: true,
        options: ['Discovery', 'Support'],
      },
    ])
    const resolver = zodResolver(schema)

    const result = await resolver(
      {
        guestName: 'Ada Lovelace',
        guestEmail: 'ada@example.com',
        guestTimezone: 'America/New_York',
        answers: {
          topic: '',
          'meeting-type': '',
        },
      } satisfies ConfirmBookingFormInputValues,
      {},
      {
        criteriaMode: 'firstError',
        fields: {},
        names: ['answers.topic', 'answers.meeting-type'],
        shouldUseNativeValidation: false,
      } as Parameters<typeof resolver>[2]
    )

    expect(result.values).toEqual({})
    expect(result.errors.answers?.topic?.message).toBe(
      'This question is required'
    )
    expect(result.errors.answers?.['meeting-type']?.message).toBe(
      'Choose one of the available options'
    )
  })
})
