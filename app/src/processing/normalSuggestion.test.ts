import { describe, expect, it } from 'vitest'
import corpusText from '../../../fixtures/vectors/normal-suggestion-v1.json?raw'
import {
  analyzeNormalSuggestion,
  NORMAL_SUGGESTION_VERSION,
  type NormalSuggestion,
} from './normalSuggestion'

interface NormalSuggestionCorpus {
  algorithmVersion: string
  cases: {
    id: string
    samples: [number, number, number][]
    expected: NormalSuggestion
  }[]
}

const corpus = JSON.parse(corpusText) as NormalSuggestionCorpus

describe('normal interpretation suggestion', () => {
  it('matches the versioned fixture corpus without false blue-image suggestions', () => {
    expect(corpus.algorithmVersion).toBe(NORMAL_SUGGESTION_VERSION)
    for (const fixtureCase of corpus.cases) {
      expect(
        analyzeNormalSuggestion(fixtureCase.samples).suggestion,
        fixtureCase.id,
      ).toBe(fixtureCase.expected)
    }
  })

  it('uses a bounded evenly distributed sample', () => {
    const samples = Array.from({ length: 10_000 }, () => [0.5, 0.5, 1] as const)
    const result = analyzeNormalSuggestion(samples, 100)

    expect(result.sampleCount).toBe(100)
    expect(result.suggestion).toBe('suggest-normal')
  })

  it('rejects empty and non-finite samples', () => {
    expect(analyzeNormalSuggestion([]).suggestion).toBe('not-normal')
    expect(analyzeNormalSuggestion([[Number.NaN, 0.5, 1]]).suggestion).toBe(
      'not-normal',
    )
  })
})
