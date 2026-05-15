import { z } from 'zod'

export const INVITEE_QUESTION_LIMIT = 10
export const INVITEE_QUESTION_OPTION_LIMIT = 10

const questionIdSchema = z
  .string()
  .min(1, 'Question ID is required')
  .max(80, 'Question ID must be 80 characters or less')
  .regex(/^[A-Za-z0-9_-]+$/, 'Question ID contains unsupported characters')

export const inviteeQuestionTypeSchema = z.enum([
  'text',
  'textarea',
  'select',
  'checkbox',
])

export const inviteeQuestionSchema = z
  .object({
    id: questionIdSchema,
    label: z
      .string()
      .trim()
      .min(1, 'Question label is required')
      .max(120, 'Question label must be 120 characters or less'),
    type: inviteeQuestionTypeSchema,
    required: z.boolean().default(false),
    options: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Option cannot be empty')
          .max(80, 'Option must be 80 characters or less')
      )
      .max(
        INVITEE_QUESTION_OPTION_LIMIT,
        `Use ${INVITEE_QUESTION_OPTION_LIMIT} options or fewer`
      )
      .default([]),
  })
  .superRefine((question, ctx) => {
    if (question.type === 'select' && question.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select questions need at least two options',
        path: ['options'],
      })
    }

    if (question.type !== 'select' && question.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only select questions can have options',
        path: ['options'],
      })
    }
  })

export const inviteeQuestionConfigSchema = z
  .array(inviteeQuestionSchema)
  .max(
    INVITEE_QUESTION_LIMIT,
    `Use ${INVITEE_QUESTION_LIMIT} invitee questions or fewer`
  )
  .superRefine((questions, ctx) => {
    const seenIds = new Set<string>()

    questions.forEach((question, index) => {
      if (seenIds.has(question.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Question IDs must be unique',
          path: [index, 'id'],
        })
      }

      seenIds.add(question.id)
    })
  })

export const inviteeAnswerValueSchema = z.union([
  z.string().max(1000, 'Answer must be 1000 characters or less'),
  z.boolean(),
])

export const inviteeAnswerRecordSchema = z.record(
  z.string(),
  inviteeAnswerValueSchema
)

export const bookingAnswerSummarySchema = z.object({
  questionId: questionIdSchema,
  label: z.string().min(1).max(120),
  type: inviteeQuestionTypeSchema,
  required: z.boolean(),
  value: inviteeAnswerValueSchema,
})

export const bookingAnswerSummaryListSchema = z.array(
  bookingAnswerSummarySchema
)

export type InviteeQuestion = z.infer<typeof inviteeQuestionSchema>
export type InviteeQuestionType = z.infer<typeof inviteeQuestionTypeSchema>
export type InviteeAnswerValue = z.infer<typeof inviteeAnswerValueSchema>
export type InviteeAnswerInput = z.infer<typeof inviteeAnswerRecordSchema>
export type BookingAnswerSummary = z.infer<typeof bookingAnswerSummarySchema>

/**
 * Parses event type JSON safely. Invalid or legacy values are treated as no
 * custom questions so public booking pages keep rendering instead of crashing.
 */
export function normalizeInviteeQuestions(value: unknown): InviteeQuestion[] {
  const parsed = inviteeQuestionConfigSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}

/**
 * Parses persisted answer JSON safely for host views and emails.
 */
export function normalizeBookingAnswerSummaries(
  value: unknown
): BookingAnswerSummary[] {
  const parsed = bookingAnswerSummaryListSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}

/**
 * Builds the dynamic answer schema used by public booking forms and server-side
 * confirmation. Required fields are derived from the event type configuration.
 */
export function createInviteeAnswersSchema(questions: InviteeQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const question of questions) {
    if (question.type === 'checkbox') {
      const checkboxSchema = z.boolean({
        invalid_type_error: 'Answer must be yes or no',
      })

      shape[question.id] = question.required
        ? checkboxSchema.refine(Boolean, 'This question is required')
        : checkboxSchema.optional().default(false)
      continue
    }

    if (question.type === 'select') {
      const selectSchema = z
        .string()
        .trim()
        .refine(
          (value) => question.options.includes(value),
          'Choose one of the available options'
        )

      shape[question.id] = question.required
        ? selectSchema
        : z
            .string()
            .trim()
            .refine(
              (value) => value === '' || question.options.includes(value),
              'Choose one of the available options'
            )
            .optional()
      continue
    }

    const maxLength = question.type === 'textarea' ? 1000 : 200
    const textSchema = z
      .string()
      .trim()
      .max(maxLength, `Answer must be ${maxLength} characters or less`)

    shape[question.id] = question.required
      ? textSchema.min(1, 'This question is required')
      : textSchema.optional()
  }

  return z.object(shape).strip()
}

type ParsedInviteeAnswers =
  | { success: true; data: BookingAnswerSummary[] }
  | { success: false; error: z.ZodError<Record<string, InviteeAnswerValue>> }

/**
 * Validates raw answer objects and snapshots labels/types beside values so
 * future question edits do not rewrite historical booking context.
 */
export function parseInviteeAnswers(
  questions: InviteeQuestion[],
  answers: unknown
): ParsedInviteeAnswers {
  const parsed = createInviteeAnswersSchema(questions).safeParse(answers ?? {})

  if (!parsed.success) {
    return { success: false, error: parsed.error }
  }

  const summaries = questions.flatMap((question): BookingAnswerSummary[] => {
    const value = parsed.data[question.id]

    if (value === undefined || value === '') {
      return []
    }

    if (question.type === 'checkbox' && value === false) {
      return []
    }

    return [
      {
        questionId: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        value,
      },
    ]
  })

  return { success: true, data: summaries }
}

export function answerSummariesToInput(
  summaries: BookingAnswerSummary[]
): InviteeAnswerInput {
  return summaries.reduce<InviteeAnswerInput>((acc, answer) => {
    acc[answer.questionId] = answer.value
    return acc
  }, {})
}

export function formatBookingAnswerValue(answer: BookingAnswerSummary): string {
  if (typeof answer.value === 'boolean') {
    return answer.value ? 'Yes' : 'No'
  }

  return answer.value
}
