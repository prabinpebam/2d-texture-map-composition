/// <reference lib="webworker" />

import { planRun } from '../domain/runPlanning'
import {
  isRunQueueRequest,
  RUN_QUEUE_PROTOCOL_VERSION,
  type NodeRunState,
  type RunQueueRequest,
  type RunQueueResponse,
  type RunRecord,
} from './runQueueProtocol'

interface ScheduledRun {
  request: Extract<RunQueueRequest, { type: 'enqueue-run' }>
  record: RunRecord
  nextNodeIndex: number
  waitingOutputId: string | null
}

const workerScope = self as DedicatedWorkerGlobalScope
const runs = new Map<string, ScheduledRun>()
const records: RunRecord[] = []
const pendingRunIds: string[] = []
const completedOutputKeys = new Set<string>()
let activeRun: ScheduledRun | null = null

function post(response: RunQueueResponse) {
  workerScope.postMessage(response)
}

function emitSnapshot() {
  post({
    protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
    type: 'queue-snapshot',
    records: records.slice(-20),
  })
}

function updateNode(run: ScheduledRun, nodeId: string, state: NodeRunState) {
  run.record = {
    ...run.record,
    nodes: { ...run.record.nodes, [nodeId]: state },
  }
  const recordIndex = records.findIndex((record) => record.id === run.record.id)
  records[recordIndex] = run.record
}

function finishRun(
  run: ScheduledRun,
  status: 'succeeded' | 'failed' | 'canceled',
  diagnostic?: string,
  startNext = true,
) {
  run.record = {
    ...run.record,
    status,
    completedAt: Date.now(),
    diagnostic,
  }
  const recordIndex = records.findIndex((record) => record.id === run.record.id)
  records[recordIndex] = run.record
  if (activeRun?.record.id === run.record.id) activeRun = null
  runs.delete(run.record.id)
  emitSnapshot()
  if (startNext) beginNextRun()
}

function executeNextNode() {
  const run = activeRun
  if (!run || run.record.status !== 'running' || run.waitingOutputId) return
  const nodeId = run.record.demandedNodeIds[run.nextNodeIndex]
  if (!nodeId) {
    finishRun(run, 'succeeded')
    return
  }

  const isOutput = run.record.targetOutputIds.includes(nodeId)
  if (isOutput) {
    const cacheKey = run.request.outputCacheKeys[nodeId]
    if (!cacheKey) {
      updateNode(run, nodeId, {
        phase: 'error',
        progress: 1,
        diagnostic: 'Output has no executable image branch',
      })
      finishRun(run, 'failed', 'Output has no executable image branch')
      return
    }
    if (completedOutputKeys.has(cacheKey)) {
      updateNode(run, nodeId, { phase: 'cached', progress: 1 })
      run.nextNodeIndex += 1
      emitSnapshot()
      setTimeout(executeNextNode, 0)
      return
    }
    updateNode(run, nodeId, { phase: 'running', progress: 0.9 })
    run.waitingOutputId = nodeId
    emitSnapshot()
    post({
      protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
      type: 'execute-output',
      runId: run.record.id,
      requestToken: run.record.requestToken,
      projectId: run.record.projectId,
      revision: run.record.revision,
      nodeId,
    })
    return
  }

  updateNode(run, nodeId, { phase: 'running', progress: 0.5 })
  emitSnapshot()
  setTimeout(() => {
    if (activeRun?.record.id !== run.record.id) return
    updateNode(run, nodeId, { phase: 'succeeded', progress: 1 })
    run.nextNodeIndex += 1
    emitSnapshot()
    setTimeout(executeNextNode, 0)
  }, 0)
}

function beginNextRun() {
  if (activeRun) return
  const runId = pendingRunIds.shift()
  if (!runId) return
  const run = runs.get(runId)
  if (!run || run.record.status !== 'queued') {
    beginNextRun()
    return
  }
  activeRun = run
  run.record = {
    ...run.record,
    status: 'running',
    startedAt: Date.now(),
  }
  records[records.findIndex((record) => record.id === runId)] = run.record
  emitSnapshot()
  setTimeout(executeNextNode, 0)
}

function enqueue(request: Extract<RunQueueRequest, { type: 'enqueue-run' }>) {
  const planning = planRun(request.document, request.targetOutputIds)
  const queuedAt = Date.now()
  if (!planning.ok) {
    records.push({
      id: request.runId,
      requestToken: request.requestToken,
      projectId: request.projectId,
      revision: request.revision,
      targetOutputIds: request.targetOutputIds ?? [],
      demandedNodeIds: [],
      status: 'failed',
      queuedAt,
      completedAt: queuedAt,
      diagnostic: JSON.stringify(planning.diagnostic),
      nodes: {},
    })
    emitSnapshot()
    return
  }
  const record: RunRecord = {
    id: request.runId,
    requestToken: request.requestToken,
    projectId: request.projectId,
    revision: request.revision,
    targetOutputIds: planning.plan.targetOutputIds,
    demandedNodeIds: planning.plan.demandedNodeIds,
    status: 'queued',
    queuedAt,
    nodes: Object.fromEntries(
      planning.plan.demandedNodeIds.map((nodeId) => [
        nodeId,
        { phase: 'queued', progress: 0 },
      ]),
    ),
  }
  const run: ScheduledRun = {
    request,
    record,
    nextNodeIndex: 0,
    waitingOutputId: null,
  }
  records.push(record)
  runs.set(record.id, run)
  pendingRunIds.push(record.id)
  emitSnapshot()
  beginNextRun()
}

function interrupt(projectId: string) {
  const run = activeRun
  if (run?.record.projectId === projectId) {
    if (run.waitingOutputId) {
      post({
        protocolVersion: RUN_QUEUE_PROTOCOL_VERSION,
        type: 'cancel-output',
        runId: run.record.id,
        requestToken: run.record.requestToken,
        projectId,
        revision: run.record.revision,
        nodeId: run.waitingOutputId,
      })
    }
    for (const nodeId of run.record.demandedNodeIds) {
      const phase = run.record.nodes[nodeId]?.phase
      if (phase === 'queued' || phase === 'running') {
        updateNode(run, nodeId, { phase: 'canceled', progress: 0 })
      }
    }
    finishRun(run, 'canceled', undefined, false)
  }

  const queuedRunIds = pendingRunIds.filter(
    (runId) => runs.get(runId)?.record.projectId === projectId,
  )
  for (const runId of queuedRunIds) {
    const queued = runs.get(runId)
    if (!queued) continue
    for (const nodeId of queued.record.demandedNodeIds) {
      updateNode(queued, nodeId, { phase: 'canceled', progress: 0 })
    }
    finishRun(queued, 'canceled', undefined, false)
    const index = pendingRunIds.indexOf(runId)
    if (index >= 0) pendingRunIds.splice(index, 1)
  }
  beginNextRun()
}

function receiveOutput(
  request: Extract<RunQueueRequest, { type: 'output-result' }>,
) {
  const run = activeRun
  if (
    !run ||
    run.record.id !== request.runId ||
    run.record.requestToken !== request.requestToken ||
    run.record.revision !== request.revision ||
    run.waitingOutputId !== request.nodeId
  ) {
    return
  }
  run.waitingOutputId = null
  if (!request.ok) {
    updateNode(run, request.nodeId, {
      phase: 'error',
      progress: 1,
      diagnostic: request.diagnostic ?? 'Output execution failed',
    })
    finishRun(run, 'failed', request.diagnostic ?? 'Output execution failed')
    return
  }
  const cacheKey = run.request.outputCacheKeys[request.nodeId]
  completedOutputKeys.add(cacheKey)
  updateNode(run, request.nodeId, {
    phase: request.cacheHit ? 'cached' : 'succeeded',
    progress: 1,
  })
  run.nextNodeIndex += 1
  emitSnapshot()
  setTimeout(executeNextNode, 0)
}

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isRunQueueRequest(event.data)) return
  const request = event.data
  if (request.type === 'enqueue-run') enqueue(request)
  else if (request.type === 'interrupt-runs') interrupt(request.projectId)
  else receiveOutput(request)
})
