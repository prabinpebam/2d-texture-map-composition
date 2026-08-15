import { describe, expect, it } from 'vitest'
import {
  applyColorCorrection,
  NEUTRAL_COLOR_CORRECTION,
} from './colorCorrection'

const pixel = { red: 0.25, green: 0.5, blue: 0.75, alpha: 0.4 }

describe('color correction v1', () => {
  it('preserves exact neutral identity and alpha', () => {
    expect(applyColorCorrection(pixel, NEUTRAL_COLOR_CORRECTION)).toBe(pixel)
  })

  it('applies hue, saturation, tint, temperature, and green-magenta distinctly', () => {
    const variants = [
      { ...NEUTRAL_COLOR_CORRECTION, hueDegrees: 90 },
      { ...NEUTRAL_COLOR_CORRECTION, saturation: -1 },
      { ...NEUTRAL_COLOR_CORRECTION, tint: [1, 0, 0] as const, tintMix: 0.25 },
      { ...NEUTRAL_COLOR_CORRECTION, temperature: 0.5 },
      { ...NEUTRAL_COLOR_CORRECTION, greenMagenta: 0.5 },
    ].map((controls) => applyColorCorrection(pixel, controls))
    expect(new Set(variants.map((color) => JSON.stringify(color))).size).toBe(5)
    expect(variants.every((color) => color.alpha === pixel.alpha)).toBe(true)
    expect(
      variants.every((color) => Object.values(color).every(Number.isFinite)),
    ).toBe(true)
  })

  it('retains out-of-gamut values and validates controls', () => {
    const result = applyColorCorrection(
      { red: 1.2, green: 0.1, blue: 0.1, alpha: 1 },
      { ...NEUTRAL_COLOR_CORRECTION, saturation: 1 },
    )
    expect(result.red).toBeGreaterThan(1)
    expect(() =>
      applyColorCorrection(pixel, {
        ...NEUTRAL_COLOR_CORRECTION,
        temperature: 2,
      }),
    ).toThrow('range')
  })
})
