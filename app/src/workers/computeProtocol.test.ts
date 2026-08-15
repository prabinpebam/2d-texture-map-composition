import { describe, expect, it } from 'vitest'
import {
  COMPUTE_PROTOCOL_VERSION,
  isComputeRequest,
  type LinearDodgeRequest,
} from './computeProtocol'

const validRequest: LinearDodgeRequest = {
  protocolVersion: COMPUTE_PROTOCOL_VERSION,
  type: 'process-linear-dodge',
  requestId: 'request-1',
  projectId: 'project-1',
  revision: 2,
  generation: 3,
  pixels: new ArrayBuffer(16),
  source: 0.25,
}

describe('compute worker protocol', () => {
  it('accepts a versioned transferable request', () => {
    expect(isComputeRequest(validRequest)).toBe(true)
  })

  it('fails closed for unknown message types and versions', () => {
    expect(isComputeRequest({ ...validRequest, type: 'unknown' })).toBe(false)
    expect(isComputeRequest({ ...validRequest, protocolVersion: 2 })).toBe(
      false,
    )
  })

  it('rejects non-finite parameters', () => {
    expect(isComputeRequest({ ...validRequest, source: Number.NaN })).toBe(
      false,
    )
  })
})
