import { describe, expect, it } from 'vitest'
import scalarFixtureText from '../../../fixtures/vectors/scalar-reference-v1.json?raw'
import {
  decodeNormal,
  destinationToSourceCoordinate,
  encodedSrgbToLinear,
  extractMask,
  heightGradientToNormal,
  linearRgbToHex,
  linearSrgbToEncoded,
  nearestSourceIndex,
  parallelLightVector,
  publishStraightAlpha,
  representativeColor,
  shadeDiffuse,
  sourceOver,
} from './scalar'

interface ScalarFixture {
  colorTransfer: { encoded: number; linear: number }[]
  alpha: {
    premultiplied: typeof opaquePixel
    straight: typeof opaquePixel
    transparentColored: typeof opaquePixel
    transparentBlack: typeof opaquePixel
  }
  composite: {
    backdrop: typeof opaquePixel
    source: typeof opaquePixel
    normal: typeof opaquePixel
    multiply: typeof opaquePixel
  }
  resize: {
    destination: number
    sourceExtent: number
    destinationExtent: number
    sourceCoordinate: number
    nearestIndex: number
  }[]
  normal: {
    encoded: [number, number, number]
    decoded: { x: number; y: number; z: number }
  }
  light: {
    azimuthDegrees: number
    elevationDegrees: number
    vector: { x: number; y: number; z: number }
  }
  representative: {
    pixels: (typeof opaquePixel)[]
    color: { red: number; green: number; blue: number }
    encodedHex: string
  }
}

const opaquePixel = {
  red: 0.25,
  green: 0.5,
  blue: 0.75,
  alpha: 0.4,
}

const fixture = JSON.parse(scalarFixtureText) as ScalarFixture

describe('scalar reference kernels', () => {
  it('matches encoded and linear sRGB transfer vectors', () => {
    for (const vector of fixture.colorTransfer) {
      expect(
        Math.abs(encodedSrgbToLinear(vector.encoded) - vector.linear),
      ).toBeLessThanOrEqual(1e-6)
      expect(
        Math.abs(linearSrgbToEncoded(vector.linear) - vector.encoded),
      ).toBeLessThanOrEqual(1e-6)
    }
  })

  it('publishes straight alpha and removes hidden transparent color', () => {
    expect(publishStraightAlpha(fixture.alpha.premultiplied)).toEqual(
      fixture.alpha.straight,
    )
    expect(publishStraightAlpha(fixture.alpha.transparentColored)).toEqual(
      fixture.alpha.transparentBlack,
    )
  })

  it('matches source-over compositing vectors', () => {
    expect(
      sourceOver(fixture.composite.backdrop, fixture.composite.source),
    ).toEqual(fixture.composite.normal)
    expect(
      sourceOver(
        fixture.composite.backdrop,
        fixture.composite.source,
        'multiply',
      ),
    ).toEqual(fixture.composite.multiply)
  })

  it('maps resize coordinates and nearest lower ties', () => {
    for (const vector of fixture.resize) {
      expect(
        destinationToSourceCoordinate(
          vector.destination,
          vector.sourceExtent,
          vector.destinationExtent,
        ),
      ).toBeCloseTo(vector.sourceCoordinate, 12)
      expect(
        nearestSourceIndex(
          vector.destination,
          vector.sourceExtent,
          vector.destinationExtent,
        ),
      ).toBe(vector.nearestIndex)
    }
  })

  it('extracts every canonical mask source', () => {
    expect(extractMask(opaquePixel, 'luminosity')).toBeCloseTo(0.4649, 6)
    expect(extractMask(opaquePixel, 'alpha')).toBe(0.4)
    expect(extractMask(opaquePixel, 'alpha', false)).toBe(1)
    expect(extractMask(opaquePixel, 'red')).toBe(0.25)
    expect(extractMask(opaquePixel, 'green')).toBe(0.5)
    expect(extractMask(opaquePixel, 'blue')).toBe(0.75)
  })

  it('decodes a neutral normal and flips the Y convention', () => {
    const neutral = decodeNormal([0.5, 0.5, 1], {
      convention: '+y',
      flipX: false,
      flipY: false,
      reconstructZ: false,
      strength: 1,
    })
    const positiveY = decodeNormal([0.5, 0.75, 1], {
      convention: '-y',
      flipX: false,
      flipY: false,
      reconstructZ: false,
      strength: 1,
    })

    expect(neutral).toEqual({ x: 0, y: 0, z: 1 })
    expect(positiveY.y).toBeLessThan(0)
    expect(Math.hypot(positiveY.x, positiveY.y, positiveY.z)).toBeCloseTo(1, 7)
    expect(
      decodeNormal(fixture.normal.encoded, {
        convention: '+y',
        flipX: false,
        flipY: false,
        reconstructZ: false,
        strength: 1,
      }),
    ).toEqual(fixture.normal.decoded)
  })

  it('derives a unit normal from a height gradient', () => {
    const normal = heightGradientToNormal(0, 1, 0.5, 0.5, 2)

    expect(normal.x).toBeLessThan(0)
    expect(normal.y).toBe(0)
    expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 7)
  })

  it('maps northwest light direction toward positive image tangent axes', () => {
    const vector = parallelLightVector(
      fixture.light.azimuthDegrees,
      fixture.light.elevationDegrees,
    )

    expect(vector.x).toBeCloseTo(fixture.light.vector.x, 7)
    expect(vector.y).toBeCloseTo(fixture.light.vector.y, 7)
    expect(vector.z).toBeCloseTo(fixture.light.vector.z, 7)
  })

  it('preserves alpha while applying diffuse light', () => {
    const result = shadeDiffuse(opaquePixel, { x: 0, y: 0, z: 1 }, [
      {
        azimuthDegrees: 315,
        elevationDegrees: 90,
        intensity: 1,
        tint: [1, 1, 1],
        tintMix: 0,
      },
    ])

    expect(result.red).toBeCloseTo(opaquePixel.red, 7)
    expect(result.green).toBeCloseTo(opaquePixel.green, 7)
    expect(result.blue).toBeCloseTo(opaquePixel.blue, 7)
    expect(result.alpha).toBe(opaquePixel.alpha)
  })

  it('computes alpha-weighted representative color and handles empty coverage', () => {
    const color = representativeColor(fixture.representative.pixels)
    expect(color).toEqual(fixture.representative.color)
    expect(linearRgbToHex(fixture.representative.color)).toBe(
      fixture.representative.encodedHex,
    )
    expect(
      representativeColor([{ red: 1, green: 0, blue: 0, alpha: 0 }]),
    ).toBeNull()
  })
})
