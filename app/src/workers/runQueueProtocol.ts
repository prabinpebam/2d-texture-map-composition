import type { GraphDocument } from '../domain/graph'

export const RUN_QUEUE_PROTOCOL_VERSION = 1 as const

export type RunStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

export type NodeRunPhase =
  'queued' | 'running' | 'cached' | 'succeeded' | 'error' | 'canceled'

export interface NodeRunState {
  phase: NodeRunPhase
  progress: number
  diagnostic?: string
}

export interface RunRecord {
  id: string
  requestToken: string
  projectId: string
  revision: number
  targetOutputIds: readonly string[]
  demandedNodeIds: readonly string[]
  status: RunStatus
  queuedAt: number
  startedAt?: number
  completedAt?: number
  diagnostic?: string
  nodes: Readonly<Record<string, NodeRunState>>
}

export type RunQueueRequest =
  | {
      protocolVersion: typeof RUN_QUEUE_PROTOCOL_VERSION
      type: 'enqueue-run'
      requestId: string
      runId: string
      requestToken: string
      projectId: string
      revision: number
      document: GraphDocument
      targetOutputIds?: readonly string[]
      outputCacheKeys: Readonly<Record<string, string>>
    }
  | {
      protocolVersion: typeof RUN_QUEUE_PROTOCOL_VERSION
      type: 'interrupt-runs'
      requestId: string
      projectId: string
    }
  | {
      protocolVersion: typeof RUN_QUEUE_PROTOCOL_VERSION
      type: 'output-result'
      requestId: string
      runId: string
      requestToken: string
      revision: number
      nodeId: string
      ok: boolean
      cacheHit: boolean
      diagnostic?: string
    }

export type RunQueueResponse =
  | {
      protocolVersion: typeof RUN_QUEUE_PROTOCOL_VERSION
      type: 'queue-snapshot'
      records: readonly RunRecord[]
    }
  | {
      protocolVersion: typeof RUN_QUEUE_PROTOCOL_VERSION
      type: 'execute-output' | 'cancel-output'
      runId: string
      requestToken: string
      projectId: string
      revision: number
      nodeId: string
    }

function isSafeRevision(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

export function isRunQueueRequest(value: unknown): value is RunQueueRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (
    candidate.protocolVersion !== RUN_QUEUE_PROTOCOL_VERSION ||
    typeof candidate.requestId !== 'string'
  ) {
    return false
  }
  if (candidate.type === 'interrupt-runs') {
    return typeof candidate.projectId === 'string'
  }
  if (candidate.type === 'output-result') {
    return (
      typeof candidate.runId === 'string' &&
      typeof candidate.requestToken === 'string' &&
      isSafeRevision(candidate.revision) &&
      typeof candidate.nodeId === 'string' &&
      typeof candidate.ok === 'boolean' &&
      typeof candidate.cacheHit === 'boolean'
    )
  }
  if (candidate.type !== 'enqueue-run') return false
  return (
    typeof candidate.runId === 'string' &&
    typeof candidate.requestToken === 'string' &&
    typeof candidate.projectId === 'string' &&
    isSafeRevision(candidate.revision) &&
    !!candidate.document &&
    typeof candidate.document === 'object' &&
    Array.isArray((candidate.document as Record<string, unknown>).nodes) &&
    Array.isArray((candidate.document as Record<string, unknown>).edges) &&
    (candidate.targetOutputIds === undefined ||
      (Array.isArray(candidate.targetOutputIds) &&
        candidate.targetOutputIds.every((id) => typeof id === 'string'))) &&
    !!candidate.outputCacheKeys &&
    typeof candidate.outputCacheKeys === 'object'
  )
}

export function isRunQueueResponse(value: unknown): value is RunQueueResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (candidate.protocolVersion !== RUN_QUEUE_PROTOCOL_VERSION) return false
  if (candidate.type === 'queue-snapshot') {
    return Array.isArray(candidate.records)
  }
  return (
    (candidate.type === 'execute-output' ||
      candidate.type === 'cancel-output') &&
    typeof candidate.runId === 'string' &&
    typeof candidate.requestToken === 'string' &&
    typeof candidate.projectId === 'string' &&
    isSafeRevision(candidate.revision) &&
    typeof candidate.nodeId === 'string'
  )
}
