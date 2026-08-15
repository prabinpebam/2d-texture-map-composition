export const NORMAL_SUGGESTION_VERSION = 'normal-suggestion.v1' as const

export type NormalSuggestion = 'suggest-normal' | 'uncertain' | 'not-normal'

export interface NormalSuggestionMetrics {
  algorithmVersion: typeof NORMAL_SUGGESTION_VERSION
  sampleCount: number
  blueMean: number
  redMean: number
  greenMean: number
  unitLengthRatio: number
  positiveZRatio: number
  suggestion: NormalSuggestion
}

export function analyzeNormalSuggestion(
  samples: readonly (readonly [number, number, number])[],
  maximumSamples = 4096,
): NormalSuggestionMetrics {
  if (samples.length === 0 || maximumSamples <= 0) {
    return {
      algorithmVersion: NORMAL_SUGGESTION_VERSION,
      sampleCount: 0,
      blueMean: 0,
      redMean: 0,
      greenMean: 0,
      unitLengthRatio: 0,
      positiveZRatio: 0,
      suggestion: 'not-normal',
    }
  }

  const stride = Math.max(1, Math.ceil(samples.length / maximumSamples))
  let sampleCount = 0
  let redSum = 0
  let greenSum = 0
  let blueSum = 0
  let unitLengthCount = 0
  let positiveZCount = 0

  for (let index = 0; index < samples.length; index += stride) {
    const [red, green, blue] = samples[index]
    if (![red, green, blue].every(Number.isFinite)) continue

    const normalX = 2 * red - 1
    const normalY = 2 * green - 1
    const normalZ = 2 * blue - 1
    const length = Math.hypot(normalX, normalY, normalZ)
    redSum += red
    greenSum += green
    blueSum += blue
    sampleCount += 1
    if (Math.abs(length - 1) <= 0.15) unitLengthCount += 1
    if (normalZ >= 0) positiveZCount += 1
  }

  if (sampleCount === 0) {
    return analyzeNormalSuggestion([], maximumSamples)
  }

  const redMean = redSum / sampleCount
  const greenMean = greenSum / sampleCount
  const blueMean = blueSum / sampleCount
  const unitLengthRatio = unitLengthCount / sampleCount
  const positiveZRatio = positiveZCount / sampleCount
  const centeredXY =
    Math.abs(redMean - 0.5) <= 0.15 && Math.abs(greenMean - 0.5) <= 0.15

  let suggestion: NormalSuggestion = 'not-normal'
  if (
    centeredXY &&
    blueMean >= 0.75 &&
    unitLengthRatio >= 0.8 &&
    positiveZRatio >= 0.95
  ) {
    suggestion = 'suggest-normal'
  } else if (
    centeredXY &&
    blueMean >= 0.6 &&
    unitLengthRatio >= 0.5 &&
    positiveZRatio >= 0.8
  ) {
    suggestion = 'uncertain'
  }

  return {
    algorithmVersion: NORMAL_SUGGESTION_VERSION,
    sampleCount,
    blueMean,
    redMean,
    greenMean,
    unitLengthRatio,
    positiveZRatio,
    suggestion,
  }
}
