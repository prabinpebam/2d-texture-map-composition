import { useCallback, useEffect, useRef, useState } from 'react'
import type { GraphDocument } from '../domain/graph'
import { ProjectRepository } from '../storage/projectRepository'
import { serializeGraphWorkflow } from '../workflow/serializeGraphWorkflow'

const repository = new ProjectRepository()
const initializationPromises = new Map<
  string,
  Promise<{
    document: GraphDocument | null
    workflowJson: string | null
    recovered: boolean
  }>
>()

export type ProjectSaveStatus =
  'loading' | 'saving' | 'saved' | 'recovered' | 'error'

export interface ProjectPersistenceState {
  status: ProjectSaveStatus
  durability: 'checking' | 'persistent' | 'best-effort'
  usageBytes: number | null
  quotaBytes: number | null
  saveNow(): Promise<void>
}

function serialize(
  document: GraphDocument,
  projectId: string,
  projectName: string,
): string {
  return serializeGraphWorkflow(document, {
    id: projectId,
    name: projectName,
    viewport: { x: 0, y: 0, zoom: 1 },
  })
}

async function initializeProject(projectId: string, projectName: string) {
  const existing = await repository.database.projects.get(projectId)
  if (!existing) {
    await repository.createProject(projectId, projectName)
  }
  const loaded = await repository.loadProject(projectId)
  if (!loaded) {
    return { document: null, workflowJson: null, recovered: false }
  }
  const { parseGraphWorkflow } = await import('./graphWorkflowBoundary')
  const parsed = parseGraphWorkflow(loaded.workflowJson)
  if (!parsed.ok) throw new Error(parsed.error)
  return {
    document: parsed.document,
    workflowJson: loaded.workflowJson,
    recovered: loaded.recoveredFromPriorSnapshot,
  }
}

export function useProjectPersistence(
  document: GraphDocument,
  hydrateDocument: (document: GraphDocument) => void,
  projectId: string,
  projectName: string,
): ProjectPersistenceState {
  const [status, setStatus] = useState<ProjectSaveStatus>('loading')
  const [readyProjectId, setReadyProjectId] = useState<string | null>(null)
  const [durabilityState, setDurabilityState] = useState<{
    projectId: string
    value: ProjectPersistenceState['durability']
  }>({ projectId: '', value: 'checking' })
  const [storageEstimate, setStorageEstimate] = useState<{
    usageBytes: number | null
    quotaBytes: number | null
  }>({ usageBytes: null, quotaBytes: null })
  const lastSavedJson = useRef<string | null>(null)
  const saveQueue = useRef(Promise.resolve())
  const persistenceRequestedFor = useRef<string | null>(null)
  const ready = readyProjectId === projectId
  const durability =
    durabilityState.projectId === projectId ? durabilityState.value : 'checking'

  const refreshStorageEstimate = useCallback(async () => {
    const estimate = await navigator.storage?.estimate?.()
    setStorageEstimate({
      usageBytes: estimate?.usage ?? null,
      quotaBytes: estimate?.quota ?? null,
    })
  }, [])

  const persistWorkflow = useCallback(
    (workflowJson: string): Promise<void> => {
      setStatus('saving')
      const operation = saveQueue.current.then(async () => {
        await repository.saveSnapshot(projectId, workflowJson)
        lastSavedJson.current = workflowJson
        await refreshStorageEstimate()
        setStatus('saved')
      })
      saveQueue.current = operation.catch(() => setStatus('error'))
      return operation
    },
    [projectId, refreshStorageEstimate],
  )

  useEffect(() => {
    let active = true
    lastSavedJson.current = null
    hydrateDocument({ nodes: [], edges: [] })
    let initializationPromise = initializationPromises.get(projectId)
    if (!initializationPromise) {
      initializationPromise = initializeProject(projectId, projectName)
      initializationPromises.set(projectId, initializationPromise)
    }
    const pendingInitialization = initializationPromise
    void pendingInitialization
      .then((result) => {
        if (initializationPromises.get(projectId) === pendingInitialization) {
          initializationPromises.delete(projectId)
        }
        if (!active) return
        if (result.document) hydrateDocument(result.document)
        lastSavedJson.current = result.workflowJson
        setReadyProjectId(projectId)
        setStatus(result.recovered ? 'recovered' : 'saved')
        void refreshStorageEstimate()
      })
      .catch(() => {
        if (initializationPromises.get(projectId) === pendingInitialization) {
          initializationPromises.delete(projectId)
        }
        if (active) {
          setReadyProjectId(projectId)
          setStatus('error')
        }
      })
    return () => {
      active = false
    }
  }, [hydrateDocument, projectId, projectName, refreshStorageEstimate])

  useEffect(() => {
    if (!ready) return
    const workflowJson = serialize(document, projectId, projectName)
    if (workflowJson === lastSavedJson.current) return

    const timeout = window.setTimeout(() => {
      void persistWorkflow(workflowJson)
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [document, persistWorkflow, projectId, projectName, ready])

  useEffect(() => {
    if (
      !ready ||
      document.nodes.length === 0 ||
      persistenceRequestedFor.current === projectId
    ) {
      return
    }
    persistenceRequestedFor.current = projectId
    void navigator.storage
      ?.persist?.()
      .then((persistent) =>
        setDurabilityState({
          projectId,
          value: persistent ? 'persistent' : 'best-effort',
        }),
      )
      .catch(() => setDurabilityState({ projectId, value: 'best-effort' }))
  }, [document.nodes.length, projectId, ready])

  return {
    status: ready ? status : 'loading',
    durability,
    usageBytes: storageEstimate.usageBytes,
    quotaBytes: storageEstimate.quotaBytes,
    saveNow: () => persistWorkflow(serialize(document, projectId, projectName)),
  }
}

export function listLocalProjects() {
  return repository.listProjects()
}

export async function createLocalProject(name: string) {
  const project = await repository.createProject(crypto.randomUUID(), name)
  initializationPromises.delete(project.id)
  return project
}

export async function renameLocalProject(projectId: string, name: string) {
  await repository.renameProject(projectId, name)
  initializationPromises.delete(projectId)
}

export async function deleteLocalProject(projectId: string) {
  await repository.deleteProject(projectId)
  initializationPromises.delete(projectId)
}
