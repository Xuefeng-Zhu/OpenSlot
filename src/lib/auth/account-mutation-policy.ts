/** Safe response used while Butterbase has no service-auth email mutation API. */
export const ACCOUNT_EMAIL_UPDATE_UNAVAILABLE = {
  code: 'EMAIL_UPDATE_UNAVAILABLE',
  message:
    'Sign-in email changes are temporarily unavailable. Your email was not changed.',
  status: 503,
} as const

/** Supported recovery path for password changes. */
export const ACCOUNT_PASSWORD_RESET_REQUIRED = {
  code: 'PASSWORD_RESET_REQUIRED',
  message: 'Use the password reset flow to change your password.',
  status: 409,
  details: { resetPath: '/forgot-password' },
} as const

/** Safe response for clients that still submit both unsupported mutations. */
export const ACCOUNT_COMBINED_UPDATE_NOT_ALLOWED = {
  code: 'COMBINED_ACCOUNT_UPDATE_NOT_ALLOWED',
  message:
    'Sign-in email changes are unavailable. Use the password reset flow to change your password.',
  status: 400,
  details: ACCOUNT_PASSWORD_RESET_REQUIRED.details,
} as const
