/// <reference lib="webworker" />

import { ProjectRepository } from '../storage/projectRepository'
import {
  isPersistenceRequest,
  PERSISTENCE_PROTOCOL_VERSION,
  type PersistenceRequest,
  type PersistenceResponse,
} from './persistenceProtocol'

const workerScope: DedicatedWorkerGlobalScope =
  self as DedicatedWorkerGlobalScope
const repository = new ProjectRepository()

async function execute(request: PersistenceRequest): Promise<unknown> {
  switch (request.type) {
    case 'initialize-project': {
      const existing = await repository.database.projects.get(request.projectId)
      const project =
        existing ??
        (await repository.createProject(request.projectId, request.projectName))
      const [loaded, checkpoint] = await Promise.all([
        repository.loadProject(request.projectId),
        repository.loadCheckpoint(request.projectId),
      ])
      const useCheckpoint = Boolean(
        checkpoint &&
        (!loaded || checkpoint.revision > loaded.snapshot.revision),
      )
      return {
        workflowJson: useCheckpoint
          ? await checkpoint!.workflowJson.text()
          : (loaded?.workflowJson ?? null),
        revision: useCheckpoint
          ? checkpoint!.revision
          : (loaded?.snapshot.revision ?? 0),
        persistenceRequested: project.persistenceRequested ?? false,
        persistent: project.persistent,
        recovered: useCheckpoint || Boolean(loaded?.recoveredFromPriorSnapshot),
      }
    }
    case 'save-snapshot': {
      const result = await repository.saveSnapshotWithQuotaRecovery(
        request.projectId,
        request.workflowJson,
        undefined,
        request.leaseToken,
      )
      return {
        revision: result.snapshot.revision,
        reclaimedBytes: result.reclaimedBytes,
      }
    }
    case 'save-checkpoint':
      await repository.saveCheckpoint(
        request.projectId,
        request.workflowJson,
        request.revision,
      )
      return null
    case 'claim-lease':
      return repository.claimLease(request.projectId, request.tabId)
    case 'renew-lease':
      return repository.renewLease(
        request.projectId,
        request.token,
        request.lastRevision,
      )
    case 'release-lease':
      return repository.releaseLease(request.projectId, request.token)
    case 'record-durability':
      await repository.recordPersistenceDecision(
        request.projectId,
        request.persistent,
      )
      return null
    case 'list-projects':
      return repository.listProjects(request.includeTrashed)
    case 'create-project': {
      const project = await repository.createProject(
        request.projectId,
        request.name,
      )
      if (request.workflowJson) {
        await repository.saveSnapshot(request.projectId, request.workflowJson)
      }
      return project
    }
    case 'rename-project':
      await repository.renameProject(request.projectId, request.name ?? '')
      return null
    case 'trash-project':
      await repository.trashProject(request.projectId)
      return null
    case 'restore-project':
      await repository.restoreProject(request.projectId)
      return null
    case 'delete-project':
      await repository.deleteProject(request.projectId)
      return null
  }
}

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isPersistenceRequest(event.data)) {
    const response: PersistenceResponse = {
      protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
      requestId: 'unknown',
      ok: false,
      error: 'Unknown or invalid persistence worker message',
    }
    workerScope.postMessage(response)
    return
  }

  const request = event.data
  void execute(request)
    .then((result) => {
      const response: PersistenceResponse = {
        protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        result,
      }
      workerScope.postMessage(response)
    })
    .catch((error: unknown) => {
      const response: PersistenceResponse = {
        protocolVersion: PERSISTENCE_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: false,
        error: error instanceof Error ? error.message : 'Persistence failed',
      }
      workerScope.postMessage(response)
    })
})
