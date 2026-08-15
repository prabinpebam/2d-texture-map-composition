export const COMPUTE_PROTOCOL_VERSION = 1 as const

interface ComputeContext {
  protocolVersion: typeof COMPUTE_PROTOCOL_VERSION
  requestId: string
  projectId: string
  revision: number
  generation: number
}

export interface LinearDodgeRequest extends ComputeContext {
  type: 'process-linear-dodge'
  pixels: ArrayBuffer
  source: number
}

export type ComputeRequest = LinearDodgeRequest

export interface ComputeResult extends ComputeContext {
  type: 'compute-result'
  backend: 'wasm' | 'scalar'
  pixels: ArrayBuffer
}

export interface ComputeFailure extends ComputeContext {
  type: 'compute-failure'
  diagnostic: string
}

export type ComputeResponse = ComputeResult | ComputeFailure

export function isComputeRequest(value: unknown): value is ComputeRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.protocolVersion === COMPUTE_PROTOCOL_VERSION &&
    candidate.type === 'process-linear-dodge' &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.projectId === 'string' &&
    Number.isSafeInteger(candidate.revision) &&
    Number.isSafeInteger(candidate.generation) &&
    candidate.pixels instanceof ArrayBuffer &&
    typeof candidate.source === 'number' &&
    Number.isFinite(candidate.source)
  )
}
