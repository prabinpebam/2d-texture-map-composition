export const TRANSPARENT_EPSILON = 1e-7

export interface LinearRgba {
  red: number
  green: number
  blue: number
  alpha: number
}

export type LinearRgb = Omit<LinearRgba, 'alpha'>

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface ParallelLight {
  azimuthDegrees: number
  elevationDegrees: number
  intensity: number
  tint: readonly [number, number, number]
  tintMix: number
}

export type MaskSource = 'luminosity' | 'alpha' | 'red' | 'green' | 'blue'

export type ScalarBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'difference'
  | 'exclusion'
  | 'linear-dodge'
  | 'linear-burn'
  | 'subtract'
  | 'divide'

export interface DecodeNormalOptions {
  convention: '+y' | '-y'
  flipX: boolean
  flipY: boolean
  reconstructZ: boolean
  strength: number
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

export function encodedSrgbToLinear(value: number): number {
  const magnitude = Math.abs(value)
  if (magnitude <= 0.04045) return value / 12.92
  return Math.sign(value) * ((magnitude + 0.055) / 1.055) ** 2.4
}

export function linearSrgbToEncoded(value: number): number {
  const magnitude = Math.abs(value)
  if (magnitude <= 0.0031308) return 12.92 * value
  return Math.sign(value) * (1.055 * magnitude ** (1 / 2.4) - 0.055)
}

export function publishStraightAlpha(premultiplied: LinearRgba): LinearRgba {
  const alpha = clamp01(premultiplied.alpha)
  if (alpha <= TRANSPARENT_EPSILON) {
    return { red: 0, green: 0, blue: 0, alpha: 0 }
  }

  return {
    red: premultiplied.red / alpha,
    green: premultiplied.green / alpha,
    blue: premultiplied.blue / alpha,
    alpha,
  }
}

export function blendChannel(
  backdrop: number,
  source: number,
  mode: ScalarBlendMode,
): number {
  switch (mode) {
    case 'normal':
      return source
    case 'multiply':
      return backdrop * source
    case 'screen':
      return backdrop + source - backdrop * source
    case 'overlay':
      return backdrop <= 0.5
        ? 2 * backdrop * source
        : 1 - 2 * (1 - backdrop) * (1 - source)
    case 'darken':
      return Math.min(backdrop, source)
    case 'lighten':
      return Math.max(backdrop, source)
    case 'difference':
      return Math.abs(backdrop - source)
    case 'exclusion':
      return backdrop + source - 2 * backdrop * source
    case 'linear-dodge':
      return Math.min(1, backdrop + source)
    case 'linear-burn':
      return Math.max(0, backdrop + source - 1)
    case 'subtract':
      return Math.max(0, backdrop - source)
    case 'divide':
      return source <= TRANSPARENT_EPSILON ? 1 : Math.min(1, backdrop / source)
  }
}

export function sourceOver(
  backdrop: LinearRgba,
  source: LinearRgba,
  mode: ScalarBlendMode = 'normal',
  opacity = 1,
  mask = 1,
): LinearRgba {
  const sourceAlpha = clamp01(source.alpha * opacity * mask)
  const backdropAlpha = clamp01(backdrop.alpha)
  const outputAlpha = sourceAlpha + backdropAlpha * (1 - sourceAlpha)
  if (outputAlpha <= TRANSPARENT_EPSILON) {
    return { red: 0, green: 0, blue: 0, alpha: 0 }
  }

  const compositeChannel = (backdropChannel: number, sourceChannel: number) => {
    const blendedSource =
      (1 - backdropAlpha) * sourceChannel +
      backdropAlpha * blendChannel(backdropChannel, sourceChannel, mode)
    const premultipliedOutput =
      sourceAlpha * blendedSource +
      backdropAlpha * backdropChannel * (1 - sourceAlpha)
    return premultipliedOutput / outputAlpha
  }

  return {
    red: compositeChannel(backdrop.red, source.red),
    green: compositeChannel(backdrop.green, source.green),
    blue: compositeChannel(backdrop.blue, source.blue),
    alpha: outputAlpha,
  }
}

export function destinationToSourceCoordinate(
  destinationCoordinate: number,
  sourceExtent: number,
  destinationExtent: number,
): number {
  return (
    ((destinationCoordinate + 0.5) / destinationExtent) * sourceExtent - 0.5
  )
}

export function nearestSourceIndex(
  destinationCoordinate: number,
  sourceExtent: number,
  destinationExtent: number,
): number {
  const sourceCoordinate = destinationToSourceCoordinate(
    destinationCoordinate,
    sourceExtent,
    destinationExtent,
  )
  const nearestWithLowerTie = Math.ceil(sourceCoordinate - 0.5)
  return Math.min(sourceExtent - 1, Math.max(0, nearestWithLowerTie))
}

export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (!Number.isFinite(length) || length <= TRANSPARENT_EPSILON) {
    return { x: 0, y: 0, z: 1 }
  }

  return {
    x: canonicalZero(vector.x / length),
    y: canonicalZero(vector.y / length),
    z: canonicalZero(vector.z / length),
  }
}

export function extractMask(
  pixel: LinearRgba,
  source: MaskSource,
  hasAlpha = true,
): number {
  switch (source) {
    case 'luminosity':
      return clamp01(
        0.2126 * pixel.red + 0.7152 * pixel.green + 0.0722 * pixel.blue,
      )
    case 'alpha':
      return hasAlpha ? clamp01(pixel.alpha) : 1
    case 'red':
      return clamp01(pixel.red)
    case 'green':
      return clamp01(pixel.green)
    case 'blue':
      return clamp01(pixel.blue)
  }
}

export function decodeNormal(
  encoded: readonly [number, number, number],
  options: DecodeNormalOptions,
): Vector3 {
  let normalX = 2 * encoded[0] - 1
  let normalY = 2 * encoded[1] - 1

  if (options.convention === '-y') normalY *= -1
  if (options.flipX) normalX *= -1
  if (options.flipY) normalY *= -1

  normalX *= options.strength
  normalY *= options.strength
  const normalZ = options.reconstructZ
    ? Math.sqrt(Math.max(0, 1 - normalX ** 2 - normalY ** 2))
    : 2 * encoded[2] - 1

  return normalizeVector({ x: normalX, y: normalY, z: normalZ })
}

export function heightGradientToNormal(
  left: number,
  right: number,
  up: number,
  down: number,
  strength: number,
): Vector3 {
  const horizontalDerivative = (right - left) / 2
  const verticalDerivative = (down - up) / 2
  return normalizeVector({
    x: -strength * horizontalDerivative,
    y: -strength * verticalDerivative,
    z: 1,
  })
}

export function parallelLightVector(
  azimuthDegrees: number,
  elevationDegrees: number,
): Vector3 {
  const azimuth = (azimuthDegrees * Math.PI) / 180
  const elevation = (elevationDegrees * Math.PI) / 180
  return normalizeVector({
    x: -Math.sin(azimuth) * Math.cos(elevation),
    y: -Math.cos(azimuth) * Math.cos(elevation),
    z: Math.sin(elevation),
  })
}

export function shadeDiffuse(
  base: LinearRgba,
  normal: Vector3,
  lights: readonly ParallelLight[],
  ambient = 0.35,
  diffuse = 0.65,
): LinearRgba {
  const contribution = [0, 0, 0]

  for (const light of lights) {
    const lightVector = parallelLightVector(
      light.azimuthDegrees,
      light.elevationDegrees,
    )
    const lambert = Math.max(
      0,
      normal.x * lightVector.x +
        normal.y * lightVector.y +
        normal.z * lightVector.z,
    )
    const tintMix = clamp01(light.tintMix)
    for (let channel = 0; channel < 3; channel += 1) {
      const lightColor = 1 - tintMix + tintMix * light.tint[channel]
      contribution[channel] += light.intensity * lambert * lightColor
    }
  }

  return {
    red: base.red * (ambient + diffuse * contribution[0]),
    green: base.green * (ambient + diffuse * contribution[1]),
    blue: base.blue * (ambient + diffuse * contribution[2]),
    alpha: clamp01(base.alpha),
  }
}

export function representativeColor(
  pixels: readonly LinearRgba[],
): LinearRgb | null {
  let alphaSum = 0
  let redSum = 0
  let greenSum = 0
  let blueSum = 0

  for (const pixel of pixels) {
    const alpha = clamp01(pixel.alpha)
    alphaSum += alpha
    redSum += alpha * pixel.red
    greenSum += alpha * pixel.green
    blueSum += alpha * pixel.blue
  }

  if (alphaSum <= TRANSPARENT_EPSILON) return null

  return {
    red: redSum / alphaSum,
    green: greenSum / alphaSum,
    blue: blueSum / alphaSum,
  }
}

export function linearRgbToHex(color: LinearRgb): string {
  const channels = [color.red, color.green, color.blue].map((channel) =>
    Math.round(clamp01(linearSrgbToEncoded(channel)) * 255),
  )
  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}
