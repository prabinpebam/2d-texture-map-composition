import { describe, expect, it } from 'vitest'
import { applyBrightnessCorrection, NEUTRAL_BRIGHTNESS } from './corrections'

const pixel = { red: 0.25, green: 0.5, blue: 0.75, alpha: 0.4 }

describe('brightness correction v1', () => {
  it('preserves exact identity and alpha at neutral controls', () => {
    const result = applyBrightnessCorrection(pixel, NEUTRAL_BRIGHTNESS)
    expect(result).toBe(pixel)
    expect(result.alpha).toBe(0.4)
  })

  it('applies exposure and tonal weights without clamping extended RGB', () => {
    const exposed = applyBrightnessCorrection(pixel, {
      ...NEUTRAL_BRIGHTNESS,
      exposure: 1,
    })
    expect(exposed).toEqual({ red: 0.5, green: 1, blue: 1.5, alpha: 0.4 })

    const shadows = applyBrightnessCorrection(
      { red: 0.05, green: 0.05, blue: 0.05, alpha: 1 },
      { ...NEUTRAL_BRIGHTNESS, shadows: 1 },
    )
    const highlights = applyBrightnessCorrection(
      { red: 0.9, green: 0.9, blue: 0.9, alpha: 1 },
      { ...NEUTRAL_BRIGHTNESS, highlights: 1 },
    )
    expect(shadows.red).toBeGreaterThan(0.05)
    expect(highlights.red).toBeGreaterThan(0.9)
  })

  it('rejects non-finite and out-of-range controls', () => {
    expect(() =>
      applyBrightnessCorrection(pixel, {
        ...NEUTRAL_BRIGHTNESS,
        exposure: Number.NaN,
      }),
    ).toThrow('finite')
    expect(() =>
      applyBrightnessCorrection(pixel, {
        ...NEUTRAL_BRIGHTNESS,
        exposure: 9,
      }),
    ).toThrow('Exposure')
    expect(() =>
      applyBrightnessCorrection(pixel, {
        ...NEUTRAL_BRIGHTNESS,
        whites: -2,
      }),
    ).toThrow('whites')
  })
})
