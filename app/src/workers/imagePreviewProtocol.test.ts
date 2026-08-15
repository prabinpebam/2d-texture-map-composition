import { describe, expect, it } from 'vitest'
import {
  IMAGE_PREVIEW_PROTOCOL_VERSION,
  isImagePreviewRequest,
} from './imagePreviewProtocol'

const validRequest = {
  protocolVersion: IMAGE_PREVIEW_PROTOCOL_VERSION,
  type: 'render-preview',
  requestId: 'request-1',
  nodeId: 'node-1',
  generation: 1,
  cacheKey: 'digest-1:color',
  blob: new Blob(['image']),
  mode: 'mask',
  maskSource: 'luminosity',
  invert: false,
  maxLongEdge: 1024,
}

describe('image preview worker protocol', () => {
  it('accepts a bounded typed preview request', () => {
    expect(isImagePreviewRequest(validRequest)).toBe(true)
  })

  it('rejects invalid generations, modes, sources, and extents', () => {
    expect(isImagePreviewRequest({ ...validRequest, generation: 1.5 })).toBe(
      false,
    )
    expect(isImagePreviewRequest({ ...validRequest, mode: 'height' })).toBe(
      false,
    )
    expect(
      isImagePreviewRequest({ ...validRequest, maskSource: 'encoded' }),
    ).toBe(false)
    expect(isImagePreviewRequest({ ...validRequest, maxLongEdge: 4096 })).toBe(
      false,
    )
  })
})
