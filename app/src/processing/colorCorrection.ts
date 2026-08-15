import type { LinearRgba } from './scalar'

export interface ColorCorrectionControls {
  temperature: number
  greenMagenta: number
  hueDegrees: number
  saturation: number
  tint: readonly [number, number, number]
  tintMix: number
}

export const NEUTRAL_COLOR_CORRECTION: Readonly<ColorCorrectionControls> = {
  temperature: 0,
  greenMagenta: 0,
  hueDegrees: 0,
  saturation: 0,
  tint: [1, 1, 1],
  tintMix: 0,
}

interface Oklab {
  lightness: number
  a: number
  b: number
}

function linearRgbToOklab(red: number, green: number, blue: number): Oklab {
  const l = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
  )
  const m = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
  )
  const s = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  )
  return {
    lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

function oklabToLinearRgb(lab: Oklab) {
  const l = (lab.lightness + 0.3963377774 * lab.a + 0.2158037573 * lab.b) ** 3
  const m = (lab.lightness - 0.1055613458 * lab.a - 0.0638541728 * lab.b) ** 3
  const s = (lab.lightness - 0.0894841775 * lab.a - 1.291485548 * lab.b) ** 3
  return {
    red: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    green: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    blue: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

function cctToXy(temperature: number) {
  const t = Math.min(12_000, Math.max(2000, temperature))
  const x =
    t <= 4000
      ? -0.2661239e9 / t ** 3 - 0.234358e6 / t ** 2 + 0.8776956e3 / t + 0.17991
      : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.24039
  const y =
    t <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : t <= 4000
        ? -0.9549476 * x ** 3 -
          1.37418593 * x ** 2 +
          2.09137015 * x -
          0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483
  return { x, y }
}

function whiteBalance(
  red: number,
  green: number,
  blue: number,
  temperatureControl: number,
) {
  if (temperatureControl === 0) return { red, green, blue }
  const source = cctToXy(6504)
  const target = cctToXy(
    Math.min(12_000, Math.max(2000, 6504 * 2 ** (-temperatureControl * 1.7))),
  )
  const xyToXyz = ({ x, y }: { x: number; y: number }) => [
    x / y,
    1,
    (1 - x - y) / y,
  ]
  const sourceWhite = xyToXyz(source)
  const targetWhite = xyToXyz(target)
  const rgbToXyz = (r: number, g: number, b: number) => [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ]
  const xyzToRgb = (x: number, y: number, z: number) => ({
    red: 3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    green: -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    blue: 0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  })
  const bradford = (xyz: number[]) => [
    0.8951 * xyz[0] + 0.2664 * xyz[1] - 0.1614 * xyz[2],
    -0.7502 * xyz[0] + 1.7135 * xyz[1] + 0.0367 * xyz[2],
    0.0389 * xyz[0] - 0.0685 * xyz[1] + 1.0296 * xyz[2],
  ]
  const inverseBradford = (lms: number[]) => [
    0.9869929 * lms[0] - 0.1470543 * lms[1] + 0.1599627 * lms[2],
    0.4323053 * lms[0] + 0.5183603 * lms[1] + 0.0492912 * lms[2],
    -0.0085287 * lms[0] + 0.0400428 * lms[1] + 0.9684867 * lms[2],
  ]
  const sourceLms = bradford(sourceWhite)
  const targetLms = bradford(targetWhite)
  const pixelLms = bradford(rgbToXyz(red, green, blue))
  const adapted = inverseBradford(
    pixelLms.map(
      (value, index) => value * (targetLms[index] / sourceLms[index]),
    ),
  )
  return xyzToRgb(adapted[0], adapted[1], adapted[2])
}

function assertControls(controls: ColorCorrectionControls) {
  if (
    ![
      controls.temperature,
      controls.greenMagenta,
      controls.hueDegrees,
      controls.saturation,
      controls.tintMix,
      ...controls.tint,
    ].every(Number.isFinite)
  ) {
    throw new Error('Color correction controls must be finite')
  }
  if (
    controls.temperature < -1 ||
    controls.temperature > 1 ||
    controls.greenMagenta < -1 ||
    controls.greenMagenta > 1 ||
    controls.saturation < -1 ||
    controls.saturation > 1 ||
    controls.tintMix < 0 ||
    controls.tintMix > 1
  ) {
    throw new Error('Color correction control is outside its supported range')
  }
}

export function applyColorCorrection(
  pixel: LinearRgba,
  controls: ColorCorrectionControls,
): LinearRgba {
  assertControls(controls)
  if (
    controls.temperature === 0 &&
    controls.greenMagenta === 0 &&
    controls.hueDegrees === 0 &&
    controls.saturation === 0 &&
    controls.tintMix === 0
  ) {
    return pixel
  }

  let color = whiteBalance(
    pixel.red,
    pixel.green,
    pixel.blue,
    controls.temperature,
  )
  let lab = linearRgbToOklab(color.red, color.green, color.blue)
  lab = { ...lab, a: lab.a - 0.05 * controls.greenMagenta }
  const chroma = Math.hypot(lab.a, lab.b)
  const hue = Math.atan2(lab.b, lab.a) + (controls.hueDegrees * Math.PI) / 180
  const saturatedChroma = chroma * Math.max(0, 1 + controls.saturation)
  color = oklabToLinearRgb({
    lightness: lab.lightness,
    a: saturatedChroma * Math.cos(hue),
    b: saturatedChroma * Math.sin(hue),
  })
  return {
    red:
      (1 - controls.tintMix) * color.red + controls.tintMix * controls.tint[0],
    green:
      (1 - controls.tintMix) * color.green +
      controls.tintMix * controls.tint[1],
    blue:
      (1 - controls.tintMix) * color.blue + controls.tintMix * controls.tint[2],
    alpha: pixel.alpha,
  }
}
