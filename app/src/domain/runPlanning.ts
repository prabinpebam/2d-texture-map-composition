import { NODE_TYPE_REGISTRY, type GraphDocument, type GraphNode } from './graph'

export interface RunPlan {
  targetOutputIds: readonly string[]
  demandedNodeIds: readonly string[]
}

export type RunPlanningDiagnostic =
  | { code: 'no-output' }
  | { code: 'invalid-output'; nodeId: string }
  | { code: 'unknown-node-type'; nodeId: string }
  | { code: 'missing-required-input'; nodeId: string; portId: string }
  | { code: 'cycle' }

export type RunPlanningResult =
  { ok: true; plan: RunPlan } | { ok: false; diagnostic: RunPlanningDiagnostic }

function compareNodes(left: GraphNode, right: GraphNode) {
  return left.zIndex - right.zIndex || left.id.localeCompare(right.id)
}

export function planRun(
  document: GraphDocument,
  requestedOutputIds?: readonly string[],
): RunPlanningResult {
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]))
  for (const node of document.nodes) {
    if (!NODE_TYPE_REGISTRY[node.type]) {
      return {
        ok: false,
        diagnostic: { code: 'unknown-node-type', nodeId: node.id },
      }
    }
  }

  const targetOutputIds = (
    requestedOutputIds ??
    document.nodes
      .filter(
        (node) =>
          NODE_TYPE_REGISTRY[node.type].category === 'output' && !node.muted,
      )
      .sort(compareNodes)
      .map((node) => node.id)
  ).filter((nodeId, index, values) => values.indexOf(nodeId) === index)

  if (targetOutputIds.length === 0) {
    return { ok: false, diagnostic: { code: 'no-output' } }
  }
  for (const nodeId of targetOutputIds) {
    const node = nodeById.get(nodeId)
    if (
      !node ||
      node.muted ||
      NODE_TYPE_REGISTRY[node.type].category !== 'output'
    ) {
      return {
        ok: false,
        diagnostic: { code: 'invalid-output', nodeId },
      }
    }
  }

  const demanded = new Set<string>()
  const pending = [...targetOutputIds]
  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (demanded.has(nodeId)) continue
    demanded.add(nodeId)
    for (const edge of document.edges) {
      if (edge.targetNodeId === nodeId) pending.push(edge.sourceNodeId)
    }
  }

  for (const nodeId of demanded) {
    const node = nodeById.get(nodeId)!
    const definition = NODE_TYPE_REGISTRY[node.type]
    for (const input of definition.inputs) {
      if (
        input.cardinality === 'required' &&
        !document.edges.some(
          (edge) =>
            edge.targetNodeId === nodeId && edge.targetPortId === input.id,
        )
      ) {
        return {
          ok: false,
          diagnostic: {
            code: 'missing-required-input',
            nodeId,
            portId: input.id,
          },
        }
      }
    }
  }

  const indegree = new Map([...demanded].map((nodeId) => [nodeId, 0]))
  for (const edge of document.edges) {
    if (demanded.has(edge.sourceNodeId) && demanded.has(edge.targetNodeId)) {
      indegree.set(
        edge.targetNodeId,
        (indegree.get(edge.targetNodeId) ?? 0) + 1,
      )
    }
  }
  const ready = [...demanded]
    .filter((nodeId) => indegree.get(nodeId) === 0)
    .map((nodeId) => nodeById.get(nodeId)!)
    .sort(compareNodes)
  const demandedNodeIds: string[] = []
  while (ready.length > 0) {
    const node = ready.shift()!
    demandedNodeIds.push(node.id)
    for (const edge of document.edges) {
      if (edge.sourceNodeId !== node.id || !demanded.has(edge.targetNodeId)) {
        continue
      }
      const nextIndegree = (indegree.get(edge.targetNodeId) ?? 0) - 1
      indegree.set(edge.targetNodeId, nextIndegree)
      if (nextIndegree === 0) {
        ready.push(nodeById.get(edge.targetNodeId)!)
        ready.sort(compareNodes)
      }
    }
  }

  if (demandedNodeIds.length !== demanded.size) {
    return { ok: false, diagnostic: { code: 'cycle' } }
  }
  return { ok: true, plan: { targetOutputIds, demandedNodeIds } }
}
