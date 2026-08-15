import { destinationToSourceCoordinate, nearestSourceIndex } from './scalar'

export type ResizeKernelId =
  | 'nearest.v1'
  | 'box-area.v1'
  | 'triangle.v1'
  | 'hermite.v1'
  | 'bspline.v1'
  | 'catmull-rom.v1'
  | 'mitchell.v1'
  | 'gaussian.v1'
  | 'lanczos2.v1'
  | 'lanczos3.v1'
  | 'lanczos4.v1'

export type ResizePreset = 'auto' | 'pixel-art' | 'smooth' | 'sharp'

export const RESIZE_KERNELS: readonly ResizeKernelId[] = [
  'nearest.v1',
  'box-area.v1',
  'triangle.v1',
  'hermite.v1',
  'bspline.v1',
  'catmull-rom.v1',
  'mitchell.v1',
  'gaussian.v1',
  'lanczos2.v1',
  'lanczos3.v1',
  'lanczos4.v1',
]

const SUPPORT: Record<ResizeKernelId, number> = {
  'nearest.v1': 0.5,
  'box-area.v1': 0.5,
  'triangle.v1': 1,
  'hermite.v1': 1,
  'bspline.v1': 2,
  'catmull-rom.v1': 2,
  'mitchell.v1': 2,
  'gaussian.v1': 2,
  'lanczos2.v1': 2,
  'lanczos3.v1': 3,
  'lanczos4.v1': 4,
}

function sinc(value: number) {
  return value === 0 ? 1 : Math.sin(Math.PI * value) / (Math.PI * value)
}

function cubic(value: number, b: number, c: number) {
  const distance = Math.abs(value)
  if (distance < 1) {
    return (
      ((12 - 9 * b - 6 * c) * distance ** 3 +
        (-18 + 12 * b + 6 * c) * distance ** 2 +
        (6 - 2 * b)) /
      6
    )
  }
  if (distance < 2) {
    return (
      ((-b - 6 * c) * distance ** 3 +
        (6 * b + 30 * c) * distance ** 2 +
        (-12 * b - 48 * c) * distance +
        (8 * b + 24 * c)) /
      6
    )
  }
  return 0
}

export function resizeKernelWeight(
  kernel: ResizeKernelId,
  value: number,
): number {
  const distance = Math.abs(value)
  switch (kernel) {
    case 'nearest.v1':
    case 'box-area.v1':
      return distance <= 0.5 ? 1 : 0
    case 'triangle.v1':
      return Math.max(0, 1 - distance)
    case 'hermite.v1':
      return distance < 1 ? 2 * distance ** 3 - 3 * distance ** 2 + 1 : 0
    case 'bspline.v1':
      return cubic(distance, 1, 0)
    case 'catmull-rom.v1':
      return cubic(distance, 0, 0.5)
    case 'mitchell.v1':
      return cubic(distance, 1 / 3, 1 / 3)
    case 'gaussian.v1':
      return distance <= 2 ? Math.exp(-(distance ** 2) / 0.5) : 0
    case 'lanczos2.v1':
      return distance < 2 ? sinc(distance) * sinc(distance / 2) : 0
    case 'lanczos3.v1':
      return distance < 3 ? sinc(distance) * sinc(distance / 3) : 0
    case 'lanczos4.v1':
      return distance < 4 ? sinc(distance) * sinc(distance / 4) : 0
  }
}

export function resolveResizePreset(
  preset: ResizePreset,
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
): ResizeKernelId {
  if (preset === 'pixel-art') return 'nearest.v1'
  if (preset === 'smooth') return 'mitchell.v1'
  if (preset === 'sharp') return 'lanczos3.v1'
  return destinationWidth < sourceWidth || destinationHeight < sourceHeight
    ? 'box-area.v1'
    : 'mitchell.v1'
}

function boxAreaSample(
  source: Float32Array,
  destinationIndex: number,
  destinationLength: number,
) {
  const scale = source.length / destinationLength
  const start = destinationIndex * scale
  const end = (destinationIndex + 1) * scale
  let weighted = 0
  let total = 0
  for (let index = Math.floor(start); index < Math.ceil(end); index += 1) {
    const overlap = Math.max(
      0,
      Math.min(end, index + 1) - Math.max(start, index),
    )
    const clampedIndex = Math.min(source.length - 1, Math.max(0, index))
    weighted += source[clampedIndex] * overlap
    total += overlap
  }
  return total > 0 ? weighted / total : 0
}

export function resampleScalar1d(
  source: Float32Array,
  destinationLength: number,
  kernel: ResizeKernelId,
): Float32Array {
  if (!Number.isSafeInteger(destinationLength) || destinationLength <= 0) {
    throw new Error('Destination extent must be a positive integer')
  }
  if (destinationLength === source.length) return source
  const destination = new Float32Array(destinationLength)
  for (
    let destinationIndex = 0;
    destinationIndex < destinationLength;
    destinationIndex += 1
  ) {
    if (kernel === 'nearest.v1') {
      destination[destinationIndex] =
        source[
          nearestSourceIndex(destinationIndex, source.length, destinationLength)
        ]
      continue
    }
    if (kernel === 'box-area.v1' && destinationLength < source.length) {
      destination[destinationIndex] = boxAreaSample(
        source,
        destinationIndex,
        destinationLength,
      )
      continue
    }
    const sourceCoordinate = destinationToSourceCoordinate(
      destinationIndex,
      source.length,
      destinationLength,
    )
    const filterScale = Math.max(1, source.length / destinationLength)
    const support = SUPPORT[kernel] * filterScale
    const first = Math.ceil(sourceCoordinate - support)
    const last = Math.floor(sourceCoordinate + support)
    let weighted = 0
    let total = 0
    for (let sourceIndex = first; sourceIndex <= last; sourceIndex += 1) {
      const clampedIndex = Math.min(source.length - 1, Math.max(0, sourceIndex))
      const weight = resizeKernelWeight(
        kernel,
        (sourceCoordinate - sourceIndex) / filterScale,
      )
      weighted += source[clampedIndex] * weight
      total += weight
    }
    destination[destinationIndex] = total !== 0 ? weighted / total : 0
  }
  return destination
}
