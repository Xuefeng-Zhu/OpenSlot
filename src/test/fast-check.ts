import * as fc from 'fast-check'

type StringOfConstraints = {
  minLength?: number
  maxLength?: number
}

export function stringOf(
  charArb: fc.Arbitrary<string>,
  constraints: StringOfConstraints = {}
): fc.Arbitrary<string> {
  return fc.array(charArb, constraints).map((chars) => chars.join(''))
}

export function char(): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength: 1 })
}
