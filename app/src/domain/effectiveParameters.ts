import type { GraphDocument, GraphNode } from './graph'

const VALUE_OUTPUTS: Readonly<Record<string, string>> = {
  'integer-value': 'integer',
  'number-value': 'float',
  'text-value': 'string',
  'boolean-value': 'boolean',
  'color-value': 'color',
}

function resolveOutputValue(
  document: GraphDocument,
  node: GraphNode,
  sourcePortId: string,
  resolving: Set<string>,
): unknown {
  if (VALUE_OUTPUTS[node.type] !== sourcePortId) return undefined
  return resolveEffectiveParameters(document, node.id, resolving).value
}

export function resolveEffectiveParameters(
  document: GraphDocument,
  nodeId: string,
  resolving = new Set<string>(),
): Record<string, unknown> {
  const node = document.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return {}
  if (resolving.has(nodeId)) return { ...node.parameters }
  const nextResolving = new Set(resolving).add(nodeId)
  const effective = { ...node.parameters }
  for (const edge of document.edges) {
    if (
      edge.targetNodeId !== nodeId ||
      !edge.targetPortId.startsWith('parameter:')
    ) {
      continue
    }
    const source = document.nodes.find(
      (candidate) => candidate.id === edge.sourceNodeId,
    )
    if (!source) continue
    const value = resolveOutputValue(
      document,
      source,
      edge.sourcePortId,
      nextResolving,
    )
    if (value !== undefined) {
      effective[edge.targetPortId.slice('parameter:'.length)] = value
    }
  }
  return effective
}
