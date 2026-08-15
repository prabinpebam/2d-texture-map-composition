import { describe, expect, it } from 'vitest'
import {
  isRunQueueRequest,
  isRunQueueResponse,
  RUN_QUEUE_PROTOCOL_VERSION,
} from './runQueueProtocol'

const enqueueRequest = {
  protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
  type: 'enqueue-run',
  requestId: 'request-1',
  runId: 'run-1',
  requestToken: 'token-1',
  projectId: 'project-1',
  revision: 4,
  document: { nodes: [], edges: [] },
  outputCacheKeys: {},
} as const

describe('run queue protocol', () => {
  it('accepts versioned immutable run requests', () => {
    expect(isRunQueueRequest(enqueueRequest)).toBe(true)
  })

  it('fails closed for unknown versions and invalid revisions', () => {
    expect(isRunQueueRequest({ ...enqueueRequest, protocolVersion: 2 })).toBe(
      false,
    )
    expect(isRunQueueRequest({ ...enqueueRequest, revision: -1 })).toBe(false)
    expect(isRunQueueRequest({ ...enqueueRequest, revision: 1.5 })).toBe(false)
  })

  it('accepts queue snapshots and rejects unknown worker messages', () => {
    expect(
      isRunQueueResponse({
        protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
        type: 'queue-snapshot',
        records: [],
      }),
    ).toBe(true)
    expect(
      isRunQueueResponse({
        protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
        type: 'completed-by-magic',
      }),
    ).toBe(false)
  })
})
