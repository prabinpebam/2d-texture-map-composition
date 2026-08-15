export const PERSISTENCE_PROTOCOL_VERSION = 1 as const

interface PersistenceRequestBase {
  protocolVersion: typeof PERSISTENCE_PROTOCOL_VERSION
  requestId: string
}

export type PersistenceRequest =
  | (PersistenceRequestBase & {
      type: 'initialize-project'
      projectId: string
      projectName: string
    })
  | (PersistenceRequestBase & {
      type: 'save-snapshot'
      projectId: string
      workflowJson: string
      leaseToken?: string
    })
  | (PersistenceRequestBase & {
      type: 'save-checkpoint'
      projectId: string
      workflowJson: string
      revision: number
    })
  | (PersistenceRequestBase & {
      type: 'claim-lease'
      projectId: string
      tabId: string
    })
  | (PersistenceRequestBase & {
      type: 'renew-lease'
      projectId: string
      token: string
      lastRevision: number
    })
  | (PersistenceRequestBase & {
      type: 'release-lease'
      projectId: string
      token: string
    })
  | (PersistenceRequestBase & {
      type: 'record-durability'
      projectId: string
      persistent: boolean
    })
  | (PersistenceRequestBase & {
      type: 'put-asset'
      projectId: string
      blob: Blob
      displayName: string
      roleHint: string
    })
  | (PersistenceRequestBase & {
      type: 'get-asset'
      projectId: string
      digest: string
    })
  | (PersistenceRequestBase & {
      type: 'list-projects'
      includeTrashed: boolean
    })
  | (PersistenceRequestBase & {
      type: 'create-project'
      projectId: string
      name: string
      workflowJson?: string
    })
  | (PersistenceRequestBase & {
      type:
        | 'rename-project'
        | 'trash-project'
        | 'restore-project'
        | 'delete-project'
      projectId: string
      name?: string
    })

export type PersistenceResponse =
  | {
      protocolVersion: typeof PERSISTENCE_PROTOCOL_VERSION
      requestId: string
      ok: true
      result: unknown
    }
  | {
      protocolVersion: typeof PERSISTENCE_PROTOCOL_VERSION
      requestId: string
      ok: false
      error: string
    }

export function isPersistenceRequest(
  value: unknown,
): value is PersistenceRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (
    candidate.protocolVersion !== PERSISTENCE_PROTOCOL_VERSION ||
    typeof candidate.requestId !== 'string' ||
    typeof candidate.type !== 'string'
  ) {
    return false
  }
  const knownTypes = new Set([
    'initialize-project',
    'save-snapshot',
    'save-checkpoint',
    'claim-lease',
    'renew-lease',
    'release-lease',
    'record-durability',
    'put-asset',
    'get-asset',
    'list-projects',
    'create-project',
    'rename-project',
    'trash-project',
    'restore-project',
    'delete-project',
  ])
  if (!knownTypes.has(candidate.type)) return false
  if (candidate.type === 'list-projects') {
    return typeof candidate.includeTrashed === 'boolean'
  }
  if (typeof candidate.projectId !== 'string') return false
  if (
    candidate.type === 'initialize-project' ||
    candidate.type === 'create-project'
  ) {
    return (
      typeof candidate.name === 'string' ||
      typeof candidate.projectName === 'string'
    )
  }
  if (candidate.type === 'save-snapshot') {
    return typeof candidate.workflowJson === 'string'
  }
  if (candidate.type === 'save-checkpoint') {
    return (
      typeof candidate.workflowJson === 'string' &&
      Number.isSafeInteger(candidate.revision)
    )
  }
  if (candidate.type === 'claim-lease')
    return typeof candidate.tabId === 'string'
  if (candidate.type === 'renew-lease') {
    return (
      typeof candidate.token === 'string' &&
      Number.isSafeInteger(candidate.lastRevision)
    )
  }
  if (candidate.type === 'release-lease') {
    return typeof candidate.token === 'string'
  }
  if (candidate.type === 'record-durability') {
    return typeof candidate.persistent === 'boolean'
  }
  if (candidate.type === 'put-asset') {
    return (
      candidate.blob instanceof Blob &&
      typeof candidate.displayName === 'string' &&
      typeof candidate.roleHint === 'string'
    )
  }
  if (candidate.type === 'get-asset') {
    return typeof candidate.digest === 'string'
  }
  if (candidate.type === 'rename-project')
    return typeof candidate.name === 'string'
  return true
}
