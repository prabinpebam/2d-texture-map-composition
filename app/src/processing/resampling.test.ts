import { describe, expect, it } from 'vitest'
import {
  RESIZE_KERNELS,
  resampleScalar1d,
  resizeKernelWeight,
  resolveResizePreset,
} from './resampling'

describe('resize reference catalog', () => {
  it('resolves presets deterministically from geometry', () => {
    expect(resolveResizePreset('auto', 8, 8, 4, 8)).toBe('box-area.v1')
    expect(resolveResizePreset('auto', 8, 8, 16, 16)).toBe('mitchell.v1')
    expect(resolveResizePreset('pixel-art', 8, 8, 3, 3)).toBe('nearest.v1')
    expect(resolveResizePreset('smooth', 8, 8, 3, 3)).toBe('mitchell.v1')
    expect(resolveResizePreset('sharp', 8, 8, 3, 3)).toBe('lanczos3.v1')
  })

  it('implements finite normalized catalog kernels and exact no-op identity', () => {
    for (const kernel of RESIZE_KERNELS) {
      expect(resizeKernelWeight(kernel, 0)).toBeGreaterThan(0)
      expect(Number.isFinite(resizeKernelWeight(kernel, 0.75))).toBe(true)
    }
    const source = new Float32Array([0, 1, 0, 1, 0])
    expect(resampleScalar1d(source, source.length, 'lanczos4.v1')).toBe(source)
  })

  it('dispatches named methods to non-degenerate outputs', () => {
    const source = new Float32Array([0, 1, 0, 0.25, 1, 0])
    const summaries = new Map(
      RESIZE_KERNELS.map((kernel) => [
        kernel,
        Array.from(resampleScalar1d(source, 4, kernel))
          .map((value) => value.toFixed(6))
          .join(','),
      ]),
    )
    expect(summaries.get('nearest.v1')).not.toBe(summaries.get('mitchell.v1'))
    expect(summaries.get('box-area.v1')).not.toBe(summaries.get('lanczos3.v1'))
    expect(new Set(summaries.values()).size).toBeGreaterThanOrEqual(8)
  })
})
