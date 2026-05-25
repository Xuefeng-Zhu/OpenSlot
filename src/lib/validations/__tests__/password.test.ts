import { describe, expect, it } from 'vitest'
import {
  getPasswordRequirements,
  isStrongPassword,
} from '@/lib/validations/password'

describe('password strength validation', () => {
  it('accepts passwords that meet every shared requirement', () => {
    expect(isStrongPassword('CorrectHorse1!')).toBe(true)
  })

  it('reports unmet password requirements for UI and API validation', () => {
    const unmetRequirementIds = getPasswordRequirements('correct-horse')
      .filter((requirement) => !requirement.isMet)
      .map((requirement) => requirement.id)

    expect(isStrongPassword('correct-horse')).toBe(false)
    expect(unmetRequirementIds).toEqual(['number', 'uppercase'])
  })
})
