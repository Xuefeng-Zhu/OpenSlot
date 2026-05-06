import { describe, it, expect } from 'vitest'
import { generateSlug } from '../slug'

describe('generateSlug', () => {
  it('converts a normal title to a lowercase hyphenated slug', () => {
    expect(generateSlug('My Event Title')).toBe('my-event-title')
  })

  it('returns "untitled" for an empty string', () => {
    expect(generateSlug('')).toBe('untitled')
  })

  it('returns "untitled" when input is only special characters', () => {
    expect(generateSlug('!@#$%^&*()')).toBe('untitled')
  })

  it('returns "untitled" when input is only whitespace', () => {
    expect(generateSlug('   ')).toBe('untitled')
  })

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug('-hello-world-')).toBe('hello-world')
  })

  it('collapses consecutive hyphens into a single hyphen', () => {
    expect(generateSlug('hello---world')).toBe('hello-world')
  })

  it('handles mixed special characters between words', () => {
    expect(generateSlug('hello & world @ 2024')).toBe('hello-world-2024')
  })

  it('handles unicode characters by replacing them with hyphens', () => {
    expect(generateSlug('café résumé')).toBe('caf-r-sum')
  })

  it('preserves numbers in the slug', () => {
    expect(generateSlug('30 Minute Meeting')).toBe('30-minute-meeting')
  })

  it('handles a single character input', () => {
    expect(generateSlug('a')).toBe('a')
  })

  it('handles input that is a single special character', () => {
    expect(generateSlug('!')).toBe('untitled')
  })

  it('handles input with leading/trailing spaces', () => {
    expect(generateSlug('  hello world  ')).toBe('hello-world')
  })
})
