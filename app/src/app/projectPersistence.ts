import { useEffect, useRef, useState } from 'react'
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
): ProjectSaveStatus {
  const [status, setStatus] = useState<ProjectSaveStatus>('loading')
  const [ready, setReady] = useState(false)
  const lastSavedJson = useRef<string | null>(null)
  const saveQueue = useRef(Promise.resolve())

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
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [hydrateDocument])

  useEffect(() => {
    if (!ready) return
    const workflowJson = serialize(document)
    if (workflowJson === lastSavedJson.current) return

    const timeout = window.setTimeout(() => {
      setStatus('saving')
      saveQueue.current = saveQueue.current
        .then(async () => {
          await repository.saveSnapshot(PROJECT_ID, workflowJson)
          lastSavedJson.current = workflowJson
          setStatus('saved')
        })
        .catch(() => setStatus('error'))
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [document, ready])

  return status
}
