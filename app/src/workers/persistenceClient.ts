import type {
  LeaseClaimResult,
  ProjectRecord,
} from '../storage/projectRepository'
import {
  PERSISTENCE_PROTOCOL_VERSION,
  type PersistenceRequest,
  type PersistenceResponse,
} from './persistenceProtocol'

interface PendingRequest {
  resolve(value: unknown): void
  reject(error: Error): void
}

type WithoutEnvelope<T> = T extends unknown
  ? Omit<T, 'protocolVersion' | 'requestId'>
  : never
type PersistenceRequestInput = WithoutEnvelope<PersistenceRequest>

export class PersistenceClient {
  private readonly worker: Worker
  private readonly pending = new Map<string, PendingRequest>()

  constructor() {
    this.worker = new Worker(
      new URL('./persistence.worker.ts', import.meta.url),
      {
        name: 'textureflow-persistence',
        type: 'module',
      },
    )
    this.worker.addEventListener(
      'message',
      (event: MessageEvent<PersistenceResponse>) => {
        const response = event.data
        const pending = this.pending.get(response.requestId)
        if (!pending) return
        this.pending.delete(response.requestId)
        if (response.ok) pending.resolve(response.result)
        else pending.reject(new Error(response.error))
      },
    )
    this.worker.addEventListener('error', () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error('Persistence worker failed'))
      }
      this.pending.clear()
    })
  }

  private request<T>(input: PersistenceRequestInput): Promise<T> {
    const requestId = crypto.randomUUID()
    const request = {
      ...input,
      protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
      requestId,
    } as PersistenceRequest
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
      })
      this.worker.postMessage(request)
    })
  }

  initializeProject(projectId: string, projectName: string) {
    return this.request<{
      workflowJson: string | null
      revision: number
      persistenceRequested: boolean
      persistent: boolean
      recovered: boolean
    }>({
      type: 'initialize-project',
      projectId,
      projectName,
    })
  }

  saveSnapshot(projectId: string, workflowJson: string, leaseToken: string) {
    return this.request<{ revision: number; reclaimedBytes: number }>({
      type: 'save-snapshot',
      projectId,
      workflowJson,
      leaseToken,
    })
  }

  saveCheckpoint(projectId: string, workflowJson: string, revision: number) {
    return this.request<null>({
      type: 'save-checkpoint',
      projectId,
      workflowJson,
      revision,
    })
  }

  claimLease(projectId: string, tabId: string) {
    return this.request<LeaseClaimResult>({
      type: 'claim-lease',
      projectId,
      tabId,
    })
  }

  renewLease(projectId: string, token: string, lastRevision: number) {
    return this.request<boolean>({
      type: 'renew-lease',
      projectId,
      token,
      lastRevision,
    })
  }

  releaseLease(projectId: string, token: string) {
    return this.request<boolean>({
      type: 'release-lease',
      projectId,
      token,
    })
  }

  recordDurability(projectId: string, persistent: boolean) {
    return this.request<null>({
      type: 'record-durability',
      projectId,
      persistent,
    })
  }

  listProjects() {
    return this.request<ProjectRecord[]>({
      type: 'list-projects',
      includeTrashed: true,
    })
  }

  createProject(projectId: string, name: string, workflowJson?: string) {
    return this.request<ProjectRecord>({
      type: 'create-project',
      projectId,
      name,
      workflowJson,
    })
  }

  renameProject(projectId: string, name: string) {
    return this.request<null>({ type: 'rename-project', projectId, name })
  }

  trashProject(projectId: string) {
    return this.request<null>({ type: 'trash-project', projectId })
  }

  restoreProject(projectId: string) {
    return this.request<null>({ type: 'restore-project', projectId })
  }

  deleteProject(projectId: string) {
    return this.request<null>({ type: 'delete-project', projectId })
  }
}

export const persistenceClient = new PersistenceClient()
