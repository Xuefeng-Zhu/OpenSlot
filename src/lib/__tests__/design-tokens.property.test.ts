import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 1: WCAG AA Contrast Compliance
 * Validates: Requirements 1.7
 *
 * For any color pairing defined in the design system (foreground text color on
 * background color), the computed contrast ratio SHALL be at least 4.5:1 for
 * normal text and at least 3:1 for large text.
 */

// HSL values from globals.css :root block (H S% L%)
interface HSLColor {
  h: number
  s: number
  l: number
}

interface ColorPairing {
  name: string
  foreground: HSLColor
  background: HSLColor
}

// All foreground/background pairings from the design system
const colorPairings: ColorPairing[] = [
  {
    name: 'foreground on background',
    foreground: { h: 222, s: 47, l: 11 },
    background: { h: 210, s: 40, l: 98 },
  },
  {
    name: 'card-foreground on card',
    foreground: { h: 222, s: 47, l: 11 },
    background: { h: 0, s: 0, l: 100 },
  },
  {
    name: 'popover-foreground on popover',
    foreground: { h: 222, s: 47, l: 11 },
    background: { h: 0, s: 0, l: 100 },
  },
  {
    name: 'primary-foreground on primary',
    foreground: { h: 210, s: 40, l: 98 },
    background: { h: 221, s: 83, l: 53 },
  },
  {
    name: 'secondary-foreground on secondary',
    foreground: { h: 222, s: 47, l: 11 },
    background: { h: 215, s: 20, l: 65 },
  },
  {
    name: 'muted-foreground on muted',
    foreground: { h: 215, s: 16, l: 43 },
    background: { h: 210, s: 40, l: 96 },
  },
  {
    name: 'accent-foreground on accent',
    foreground: { h: 221, s: 83, l: 43 },
    background: { h: 214, s: 95, l: 93 },
  },
  {
    name: 'destructive-foreground on destructive',
    foreground: { h: 0, s: 0, l: 100 },
    background: { h: 0, s: 72, l: 51 },
  },
  {
    name: 'success-foreground on success',
    foreground: { h: 0, s: 0, l: 100 },
    background: { h: 160, s: 84, l: 28 },
  },
  {
    name: 'warning-foreground on warning',
    foreground: { h: 0, s: 0, l: 100 },
    background: { h: 32, s: 95, l: 35 },
  },
]

/**
 * Convert HSL to RGB.
 * H in degrees [0, 360], S and L in percent [0, 100].
 * Returns RGB values in [0, 255].
 */
function hslToRgb(hsl: HSLColor): { r: number; g: number; b: number } {
  const h = hsl.h / 360
  const s = hsl.s / 100
  const l = hsl.l / 100

  if (s === 0) {
    const val = Math.round(l * 255)
    return { r: val, g: val, b: val }
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  const r = hue2rgb(p, q, h + 1 / 3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1 / 3)

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Compute relative luminance per WCAG 2.1 formula.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const linearize = (channel: number): number => {
    const sRGB = channel / 255
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  }

  const rLin = linearize(rgb.r)
  const gLin = linearize(rgb.g)
  const bLin = linearize(rgb.b)

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin
}

/**
 * Compute contrast ratio per WCAG 2.1 formula.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function contrastRatio(fg: HSLColor, bg: HSLColor): number {
  const fgLum = relativeLuminance(hslToRgb(fg))
  const bgLum = relativeLuminance(hslToRgb(bg))

  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)

  return (lighter + 0.05) / (darker + 0.05)
}

describe('Property 1: WCAG AA Contrast Compliance', () => {
  it('all foreground/background color pairings meet 4.5:1 minimum for normal text', () => {
    fc.assert(
      fc.property(fc.constantFrom(...colorPairings), (pairing) => {
        const ratio = contrastRatio(pairing.foreground, pairing.background)
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      }),
      { numRuns: 100 }
    )
  })

  it('all foreground/background color pairings meet 3:1 minimum for large text', () => {
    fc.assert(
      fc.property(fc.constantFrom(...colorPairings), (pairing) => {
        const ratio = contrastRatio(pairing.foreground, pairing.background)
        expect(ratio).toBeGreaterThanOrEqual(3)
      }),
      { numRuns: 100 }
    )
  })
})
