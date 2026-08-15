import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { normalizeVector, publishStraightAlpha, sourceOver } from './scalar'

const channel = fc.double({ min: 0, max: 1, noNaN: true })
const pixel = fc.record({
  red: channel,
  green: channel,
  blue: channel,
  alpha: channel,
})

describe('scalar reference invariants', () => {
  it('keeps source-over alpha in range and output finite', () => {
    fc.assert(
      fc.property(pixel, pixel, (backdrop, source) => {
        const result = sourceOver(backdrop, source)
        expect(result.alpha).toBeGreaterThanOrEqual(0)
        expect(result.alpha).toBeLessThanOrEqual(1)
        expect(Object.values(result).every(Number.isFinite)).toBe(true)
      }),
    )
  })

  it('publishes transparent pixels as transparent black', () => {
    fc.assert(
      fc.property(channel, channel, channel, (red, green, blue) => {
        expect(publishStraightAlpha({ red, green, blue, alpha: 0 })).toEqual({
          red: 0,
          green: 0,
          blue: 0,
          alpha: 0,
        })
      }),
    )
  })

  it('normalizes finite nonzero vectors to unit length', () => {
    const component = fc.double({ min: -100, max: 100, noNaN: true })
    fc.assert(
      fc.property(component, component, component, (x, y, z) => {
        fc.pre(Math.hypot(x, y, z) > 1e-7)
        const result = normalizeVector({ x, y, z })
        expect(Math.hypot(result.x, result.y, result.z)).toBeCloseTo(1, 12)
      }),
    )
  })
})
