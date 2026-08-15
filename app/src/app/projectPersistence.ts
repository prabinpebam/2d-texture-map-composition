import { useCallback, useEffect, useRef, useState } from 'react'
import type { GraphDocument } from '../domain/graph'
import { ProjectRepository } from '../storage/projectRepository'
import { serializeGraphWorkflow } from '../workflow/serializeGraphWorkflow'

const PROJECT_ID = 'untitled-workflow'
const repository = new ProjectRepository()
let initializationPromise: Promise<{
  document: GraphDocument | null
  workflowJson: string | null
  recovered: boolean
}> | null = null

export type ProjectSaveStatus =
  'loading' | 'saving' | 'saved' | 'recovered' | 'error'

export interface ProjectPersistenceState {
  status: ProjectSaveStatus
  durability: 'checking' | 'persistent' | 'best-effort'
  usageBytes: number | null
  quotaBytes: number | null
  saveNow(): Promise<void>
}

function serialize(document: GraphDocument): string {
  return serializeGraphWorkflow(document, {
    id: PROJECT_ID,
    name: 'Untitled workflow',
    viewport: { x: 0, y: 0, zoom: 1 },
  })
}

async function initializeProject() {
  const existing = await repository.database.projects.get(PROJECT_ID)
  if (!existing) {
    await repository.createProject(PROJECT_ID, 'Untitled workflow')
  }
  const loaded = await repository.loadProject(PROJECT_ID)
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
): ProjectPersistenceState {
  const [status, setStatus] = useState<ProjectSaveStatus>('loading')
  const [ready, setReady] = useState(false)
  const [durability, setDurability] =
    useState<ProjectPersistenceState['durability']>('checking')
  const [storageEstimate, setStorageEstimate] = useState<{
    usageBytes: number | null
    quotaBytes: number | null
  }>({ usageBytes: null, quotaBytes: null })
  const lastSavedJson = useRef<string | null>(null)
  const saveQueue = useRef(Promise.resolve())
  const persistenceRequested = useRef(false)

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
        await repository.saveSnapshot(PROJECT_ID, workflowJson)
        lastSavedJson.current = workflowJson
        await refreshStorageEstimate()
        setStatus('saved')
      })
      saveQueue.current = operation.catch(() => setStatus('error'))
      return operation
    },
    [refreshStorageEstimate],
  )

  useEffect(() => {
    let active = true
    initializationPromise ??= initializeProject()
    void initializationPromise
      .then((result) => {
        if (!active) return
        if (result.document) hydrateDocument(result.document)
        lastSavedJson.current = result.workflowJson
        setReady(true)
        setStatus(result.recovered ? 'recovered' : 'saved')
        void refreshStorageEstimate()
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [hydrateDocument, refreshStorageEstimate])

  useEffect(() => {
    if (!ready) return
    const workflowJson = serialize(document)
    if (workflowJson === lastSavedJson.current) return

    const timeout = window.setTimeout(() => {
      void persistWorkflow(workflowJson)
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [document, persistWorkflow, ready])

  useEffect(() => {
    if (!ready || document.nodes.length === 0 || persistenceRequested.current) {
      return
    }
    persistenceRequested.current = true
    void navigator.storage
      ?.persist?.()
      .then((persistent) =>
        setDurability(persistent ? 'persistent' : 'best-effort'),
      )
      .catch(() => setDurability('best-effort'))
  }, [document.nodes.length, ready])

  return {
    status,
    durability,
    usageBytes: storageEstimate.usageBytes,
    quotaBytes: storageEstimate.quotaBytes,
    saveNow: () => persistWorkflow(serialize(document)),
  }
}
