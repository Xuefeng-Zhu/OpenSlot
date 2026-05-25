export const PASSWORD_COMPLEXITY_ERROR =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and a special character.'

export interface PasswordRequirement {
  id: 'length' | 'number' | 'lowercase' | 'uppercase' | 'special'
  label: string
  isMet: boolean
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: 'length',
      label: 'At least 8 characters',
      isMet: password.length >= 8,
    },
    {
      id: 'number',
      label: 'Includes a number',
      isMet: /\d/.test(password),
    },
    {
      id: 'lowercase',
      label: 'Includes a lowercase letter',
      isMet: /[a-z]/.test(password),
    },
    {
      id: 'uppercase',
      label: 'Includes an uppercase letter',
      isMet: /[A-Z]/.test(password),
    },
    {
      id: 'special',
      label: 'Includes a special character',
      isMet: /[^\sA-Za-z0-9]/.test(password),
    },
  ]
}

export function isStrongPassword(password: string) {
  return getPasswordRequirements(password).every(
    (requirement) => requirement.isMet
  )
}
