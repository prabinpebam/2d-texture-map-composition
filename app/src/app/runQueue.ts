import { useEffect, useState } from 'react'
import {
  getRunQueueClient,
  type EnqueueRunInput,
  type RunExecutionHooks,
} from '../workers/runQueueClient'
import type { RunRecord } from '../workers/runQueueProtocol'

export function useRunRecords(enabled: boolean) {
  const [records, setRecords] = useState<readonly RunRecord[]>([])
  useEffect(() => {
    if (!enabled) return
    return getRunQueueClient().subscribe(setRecords)
  }, [enabled])
  return records
}

export function enqueueRun(input: EnqueueRunInput, hooks: RunExecutionHooks) {
  return getRunQueueClient().enqueue(input, hooks)
}

export function interruptRuns(projectId: string) {
  getRunQueueClient().interrupt(projectId)
}

export type { RunRecord }
