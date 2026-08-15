import type { GraphDocument } from '../domain/graph'
import {
  isRunQueueResponse,
  RUN_QUEUE_PROTOCOL_VERSION,
  type RunQueueRequest,
  type RunRecord,
} from './runQueueProtocol'

export interface OutputExecutionContext {
  runId: string
  requestToken: string
  projectId: string
  revision: number
  nodeId: string
}

export interface RunExecutionHooks {
  execute(context: OutputExecutionContext): Promise<{ cacheHit: boolean }>
  cancel(context: OutputExecutionContext): void
}

export interface EnqueueRunInput {
  projectId: string
  revision: number
  document: GraphDocument
  targetOutputIds?: readonly string[]
  outputCacheKeys: Readonly<Record<string, string>>
}

type Listener = (records: readonly RunRecord[]) => void

export class RunQueueClient {
  private readonly worker: Worker
  private readonly listeners = new Set<Listener>()
  private readonly hooksByRunId = new Map<string, RunExecutionHooks>()
  private records: readonly RunRecord[] = []

  constructor() {
    this.worker = new Worker(new URL('./runQueue.worker.ts', import.meta.url), {
      name: 'textureflow-run-queue',
      type: 'module',
    })
    this.worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!isRunQueueResponse(event.data)) return
      const response = event.data
      if (response.type === 'queue-snapshot') {
        this.records = response.records
        const liveRunIds = new Set(
          this.records
            .filter(
              (record) =>
                record.status === 'queued' || record.status === 'running',
            )
            .map((record) => record.id),
        )
        for (const runId of this.hooksByRunId.keys()) {
          if (!liveRunIds.has(runId)) this.hooksByRunId.delete(runId)
        }
        for (const listener of this.listeners) listener(this.records)
        return
      }
      const hooks = this.hooksByRunId.get(response.runId)
      if (!hooks) return
      if (response.type === 'cancel-output') {
        hooks.cancel(response)
        return
      }
      void hooks
        .execute(response)
        .then((result) => {
          this.post({
            protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
            type: 'output-result',
            requestId: crypto.randomUUID(),
            runId: response.runId,
            requestToken: response.requestToken,
            revision: response.revision,
            nodeId: response.nodeId,
            ok: true,
            cacheHit: result.cacheHit,
          })
        })
        .catch((error: unknown) => {
          this.post({
            protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
            type: 'output-result',
            requestId: crypto.randomUUID(),
            runId: response.runId,
            requestToken: response.requestToken,
            revision: response.revision,
            nodeId: response.nodeId,
            ok: false,
            cacheHit: false,
            diagnostic:
              error instanceof Error
                ? error.message
                : 'Output execution failed',
          })
        })
    })
  }

  private post(request: RunQueueRequest) {
    this.worker.postMessage(request)
  }

  enqueue(input: EnqueueRunInput, hooks: RunExecutionHooks) {
    const runId = crypto.randomUUID()
    const requestToken = crypto.randomUUID()
    this.hooksByRunId.set(runId, hooks)
    this.post({
      protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
      type: 'enqueue-run',
      requestId: crypto.randomUUID(),
      runId,
      requestToken,
      ...input,
    })
    return runId
  }

  interrupt(projectId: string) {
    this.post({
      protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
      type: 'interrupt-runs',
      requestId: crypto.randomUUID(),
      projectId,
    })
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    listener(this.records)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getRecords() {
    return this.records
  }
}

let runQueueClient: RunQueueClient | null = null

export function getRunQueueClient() {
  runQueueClient ??= new RunQueueClient()
  return runQueueClient
}
