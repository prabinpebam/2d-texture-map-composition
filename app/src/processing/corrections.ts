import type { LinearRgba } from './scalar'

export interface BrightnessControls {
  exposure: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
}

export const NEUTRAL_BRIGHTNESS: Readonly<BrightnessControls> = {
  exposure: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(start: number, end: number, value: number) {
  const amount = clamp01((value - start) / (end - start))
  return amount ** 2 * (3 - 2 * amount)
}

function assertControls(controls: BrightnessControls) {
  if (!Object.values(controls).every(Number.isFinite)) {
    throw new Error('Brightness controls must be finite')
  }
  if (controls.exposure < -8 || controls.exposure > 8) {
    throw new Error('Exposure must be between -8 and 8 EV')
  }
  for (const key of ['highlights', 'shadows', 'whites', 'blacks'] as const) {
    if (controls[key] < -1 || controls[key] > 1) {
      throw new Error(`${key} must be between -1 and 1`)
    }
  }
}

export function applyBrightnessCorrection(
  pixel: LinearRgba,
  controls: BrightnessControls,
): LinearRgba {
  assertControls(controls)
  if (
    controls.exposure === 0 &&
    controls.highlights === 0 &&
    controls.shadows === 0 &&
    controls.whites === 0 &&
    controls.blacks === 0
  ) {
    return pixel
  }

  const luminance =
    0.2126 * pixel.red + 0.7152 * pixel.green + 0.0722 * pixel.blue
  const shadowWeight = (1 - smoothstep(0, 0.5, luminance)) ** 2
  const highlightWeight = smoothstep(0.5, 1, luminance) ** 2
  const blackWeight = 1 - smoothstep(0, 0.25, luminance)
  const whiteWeight = smoothstep(0.75, 1, luminance)
  const gain =
    2 **
    (controls.exposure +
      1.5 *
        (controls.shadows * shadowWeight +
          controls.highlights * highlightWeight) +
      (controls.blacks * blackWeight + controls.whites * whiteWeight))

  return {
    red: pixel.red * gain,
    green: pixel.green * gain,
    blue: pixel.blue * gain,
    alpha: pixel.alpha,
  }
}
