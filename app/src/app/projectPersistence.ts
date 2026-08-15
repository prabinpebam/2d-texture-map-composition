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
  access: 'claiming' | 'writer' | 'read-only'
  foreignTabId: string | null
  durability: 'checking' | 'persistent' | 'best-effort'
  usageBytes: number | null
  quotaBytes: number | null
  saveNow(): Promise<void>
  takeOver(): Promise<void>
}

function getTabId(): string {
  const existing = sessionStorage.getItem('textureflow-tab-id')
  if (existing) return existing
  const tabId = crypto.randomUUID()
  sessionStorage.setItem('textureflow-tab-id', tabId)
  return tabId
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
  const [loaded, checkpoint] = await Promise.all([
    repository.loadProject(projectId),
    repository.loadCheckpoint(projectId),
  ])
  const useCheckpoint = Boolean(
    checkpoint && (!loaded || checkpoint.revision > loaded.snapshot.revision),
  )
  const workflowJson = useCheckpoint
    ? await checkpoint!.workflowJson.text()
    : loaded?.workflowJson
  if (!workflowJson) {
    return { document: null, workflowJson: null, recovered: false }
  }
  const { parseGraphWorkflow } = await import('./graphWorkflowBoundary')
  const parsed = parseGraphWorkflow(workflowJson)
  if (!parsed.ok) throw new Error(parsed.error)
  return {
    document: parsed.document,
    workflowJson,
    recovered: useCheckpoint || Boolean(loaded?.recoveredFromPriorSnapshot),
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
  const [leaseState, setLeaseState] = useState<{
    projectId: string
    access: ProjectPersistenceState['access']
    token: string | null
    foreignTabId: string | null
  }>({ projectId: '', access: 'claiming', token: null, foreignTabId: null })
  const [leaseAttempt, setLeaseAttempt] = useState(0)
  const lastSavedJson = useRef<string | null>(null)
  const saveQueue = useRef(Promise.resolve())
  const persistenceRequestedFor = useRef<string | null>(null)
  const ready = readyProjectId === projectId
  const durability =
    durabilityState.projectId === projectId ? durabilityState.value : 'checking'
  const access =
    leaseState.projectId === projectId ? leaseState.access : 'claiming'
  const leaseToken =
    leaseState.projectId === projectId ? leaseState.token : null
  const latestDocument = useRef(document)
  useEffect(() => {
    latestDocument.current = document
  }, [document])

  const refreshStorageEstimate = useCallback(async () => {
    const estimate = await navigator.storage?.estimate?.()
    setStorageEstimate({
      usageBytes: estimate?.usage ?? null,
      quotaBytes: estimate?.quota ?? null,
    })
  }, [])

  const persistWorkflow = useCallback(
    (workflowJson: string): Promise<void> => {
      if (access !== 'writer' || !leaseToken) {
        return Promise.reject(new Error('Project is open read-only'))
      }
      setStatus('saving')
      const operation = saveQueue.current.then(async () => {
        await repository.saveSnapshotWithQuotaRecovery(
          projectId,
          workflowJson,
          undefined,
          leaseToken,
        )
        lastSavedJson.current = workflowJson
        await refreshStorageEstimate()
        setStatus('saved')
      })
      saveQueue.current = operation.catch(() => setStatus('error'))
      return operation
    },
    [access, leaseToken, projectId, refreshStorageEstimate],
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
    let active = true
    let ownedToken: string | null = null
    let renewalTimer = 0
    const tabId = getTabId()

    void repository
      .claimLease(projectId, tabId)
      .then((result) => {
        if (!active) {
          if (result.acquired) {
            void repository.releaseLease(projectId, result.lease.token)
          }
          return
        }
        if (!result.acquired) {
          setLeaseState({
            projectId,
            access: 'read-only',
            token: null,
            foreignTabId: result.lease.tabId,
          })
          return
        }
        ownedToken = result.lease.token
        setLeaseState({
          projectId,
          access: 'writer',
          token: ownedToken,
          foreignTabId: null,
        })
        renewalTimer = window.setInterval(() => {
          void repository.database.projects
            .get(projectId)
            .then((project) =>
              repository.renewLease(
                projectId,
                ownedToken!,
                project?.revision ?? 0,
              ),
            )
            .then((renewed) => {
              if (!renewed && active) {
                setLeaseState({
                  projectId,
                  access: 'read-only',
                  token: null,
                  foreignTabId: 'another tab',
                })
              }
            })
        }, 2000)
      })
      .catch(() => {
        if (active) {
          setLeaseState({
            projectId,
            access: 'read-only',
            token: null,
            foreignTabId: 'unknown',
          })
        }
      })

    return () => {
      active = false
      window.clearInterval(renewalTimer)
      if (ownedToken) void repository.releaseLease(projectId, ownedToken)
    }
  }, [leaseAttempt, projectId, ready])

  useEffect(() => {
    if (!ready || access !== 'writer') return
    const workflowJson = serialize(document, projectId, projectName)
    if (workflowJson === lastSavedJson.current) return

    const timeout = window.setTimeout(() => {
      void persistWorkflow(workflowJson)
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [access, document, persistWorkflow, projectId, projectName, ready])

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
  useEffect(() => {
    if (!ready || access !== 'writer') return
    function checkpoint() {
      const workflowJson = serialize(
        latestDocument.current,
        projectId,
        projectName,
      )
      void repository.database.projects
        .get(projectId)
        .then((project) =>
          repository.saveCheckpoint(
            projectId,
            workflowJson,
            (project?.revision ?? 0) + 1,
          ),
        )
        .catch(() => undefined)
    }
    function checkpointWhenHidden() {
      if (globalThis.document.visibilityState === 'hidden') checkpoint()
    }
    window.addEventListener('pagehide', checkpoint)
    globalThis.document.addEventListener(
      'visibilitychange',
      checkpointWhenHidden,
    )
    return () => {
      window.removeEventListener('pagehide', checkpoint)
      globalThis.document.removeEventListener(
        'visibilitychange',
        checkpointWhenHidden,
      )
    }
  }, [access, projectId, projectName, ready])

  async function takeOver() {
    if (access !== 'read-only') return
    const channel = new BroadcastChannel('textureflow-leases')
    channel.postMessage({ type: 'takeover-intent', projectId })
    channel.close()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 2100))
      const result = await repository.claimLease(projectId, getTabId())
      if (result.acquired) {
        setLeaseState({
          projectId,
          access: 'writer',
          token: result.lease.token,
          foreignTabId: null,
        })
        setLeaseAttempt((currentAttempt) => currentAttempt + 1)
        return
      }
    }
  }

  return {
    status: ready ? status : 'loading',
    access,
    foreignTabId:
      leaseState.projectId === projectId ? leaseState.foreignTabId : null,
    durability,
    usageBytes: storageEstimate.usageBytes,
    quotaBytes: storageEstimate.quotaBytes,
    saveNow: () => persistWorkflow(serialize(document, projectId, projectName)),
    takeOver,
  }
}

export function listLocalProjects() {
  return repository.listProjects(true)
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

export async function trashLocalProject(projectId: string) {
  await repository.trashProject(projectId)
  initializationPromises.delete(projectId)
}

export async function restoreLocalProject(projectId: string) {
  await repository.restoreProject(projectId)
  initializationPromises.delete(projectId)
}

export async function createLocalProjectCopy(
  name: string,
  document: GraphDocument,
) {
  const project = await repository.createProject(crypto.randomUUID(), name)
  const workflowJson = serialize(document, project.id, project.name)
  await repository.saveSnapshot(project.id, workflowJson)
  initializationPromises.delete(project.id)
  return project
}
