import * as fc from 'fast-check'

type StringOfConstraints = {
  minLength?: number
  maxLength?: number
}

type DateConstraints = NonNullable<Parameters<typeof fc.date>[0]>

export function stringOf(
  charArb: fc.Arbitrary<string>,
  constraints: StringOfConstraints = {}
): fc.Arbitrary<string> {
  return fc.array(charArb, constraints).map((chars) => chars.join(''))
}

export function char(): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength: 1 })
}

export function validDate(constraints: DateConstraints = {}): fc.Arbitrary<Date> {
  return fc.date({ ...constraints, noInvalidDate: true })
}
