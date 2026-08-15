import { describe, expect, it } from 'vitest'
import {
  isPersistenceRequest,
  PERSISTENCE_PROTOCOL_VERSION,
} from './persistenceProtocol'

describe('persistence worker protocol', () => {
  it('accepts versioned project and snapshot requests', () => {
    expect(
      isPersistenceRequest({
        protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
        requestId: 'request-1',
        type: 'save-snapshot',
        projectId: 'project-1',
        workflowJson: '{}',
      }),
    ).toBe(true)
    expect(
      isPersistenceRequest({
        protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
        requestId: 'request-2',
        type: 'list-projects',
        includeTrashed: true,
      }),
    ).toBe(true)
  })

  it('fails closed for unknown versions, messages, and invalid revisions', () => {
    expect(
      isPersistenceRequest({
        protocolVersion: 2,
        requestId: 'request-1',
        type: 'list-projects',
        includeTrashed: true,
      }),
    ).toBe(false)
    expect(
      isPersistenceRequest({
        protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
        requestId: 'request-2',
        type: 'unknown',
      }),
    ).toBe(false)
    expect(
      isPersistenceRequest({
        protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
        requestId: 'request-3',
        type: 'save-checkpoint',
        projectId: 'project-1',
        workflowJson: '{}',
        revision: Number.NaN,
      }),
    ).toBe(false)
  })
})
