import { NODE_CATALOG, type NodeCatalogItem } from './workspace'
import { getDefaultNodeParameters } from './nodeWidgetSchema'

export type PortDataType =
  'image' | 'mask' | 'height' | 'normal' | 'color' | 'light'

export interface InputPortDefinition {
  id: string
  label: string
  accepts: readonly PortDataType[]
  cardinality: 'required' | 'optional' | 'variadic'
}

export interface OutputPortDefinition {
  id: string
  label: string
  dataType: PortDataType
}

export interface NodeTypeDefinition extends NodeCatalogItem {
  inputs: readonly InputPortDefinition[]
  outputs: readonly OutputPortDefinition[]
}

export interface GraphNode {
  id: string
  type: string
  label: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
  bypassed: boolean
  muted: boolean
  locked: boolean
  parameters?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  order: number
}

export interface GraphDocument {
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
}

export type ConnectionDiagnostic =
  | 'missing-node'
  | 'missing-port'
  | 'incompatible-type'
  | 'cardinality-exceeded'
  | 'cycle'
  | 'duplicate-edge'

export type ConnectionResult =
  | { ok: true; graph: GraphDocument }
  | { ok: false; diagnostic: ConnectionDiagnostic }

const definitions: Record<
  string,
  Omit<NodeTypeDefinition, keyof NodeCatalogItem>
> = {
  'load-image': {
    inputs: [],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  },
  light: {
    inputs: [],
    outputs: [{ id: 'light', label: 'Light', dataType: 'light' }],
  },
  material: {
    inputs: [
      {
        id: 'base',
        label: 'Base color',
        accepts: ['image', 'color'],
        cardinality: 'required',
      },
      {
        id: 'opacity',
        label: 'Opacity',
        accepts: ['mask'],
        cardinality: 'optional',
      },
      {
        id: 'relief',
        label: 'Relief',
        accepts: ['normal', 'height'],
        cardinality: 'optional',
      },
      {
        id: 'lights',
        label: 'Lights',
        accepts: ['light'],
        cardinality: 'variadic',
      },
    ],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  },
  merge: {
    inputs: [
      {
        id: 'background',
        label: 'Background',
        accepts: ['image'],
        cardinality: 'required',
      },
      {
        id: 'foreground',
        label: 'Foreground',
        accepts: ['image'],
        cardinality: 'required',
      },
      { id: 'mask', label: 'Mask', accepts: ['mask'], cardinality: 'optional' },
    ],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  },
  resize: {
    inputs: [
      {
        id: 'input',
        label: 'Input',
        accepts: ['image', 'mask', 'height', 'normal'],
        cardinality: 'required',
      },
    ],
    outputs: [{ id: 'output', label: 'Output', dataType: 'image' }],
  },
  'color-correction': {
    inputs: [
      {
        id: 'image',
        label: 'Image',
        accepts: ['image'],
        cardinality: 'required',
      },
    ],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  },
  'brightness-correction': {
    inputs: [
      {
        id: 'image',
        label: 'Image',
        accepts: ['image'],
        cardinality: 'required',
      },
    ],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image' }],
  },
  'representative-color': {
    inputs: [
      {
        id: 'image',
        label: 'Image',
        accepts: ['image'],
        cardinality: 'required',
      },
    ],
    outputs: [{ id: 'color', label: 'Color', dataType: 'color' }],
  },
  preview: {
    inputs: [
      {
        id: 'image',
        label: 'Image',
        accepts: ['image', 'mask'],
        cardinality: 'required',
      },
    ],
    outputs: [],
  },
}

export const NODE_TYPE_REGISTRY = Object.fromEntries(
  NODE_CATALOG.map((item) => [item.id, { ...item, ...definitions[item.id] }]),
) as Readonly<Record<string, NodeTypeDefinition>>

export function getDefaultNodeSize(type: string): GraphNode['size'] {
  return {
    width: type === 'preview' ? 320 : 280,
    height:
      type === 'preview'
        ? 360
        : type === 'color-correction'
          ? 520
          : type === 'brightness-correction'
            ? 470
            : type === 'resize'
              ? 430
              : type === 'load-image'
                ? 300
                : 128,
  }
}

export function createGraphNode(
  type: string,
  id: string,
  position: GraphNode['position'],
  zIndex: number,
): GraphNode {
  const definition = NODE_TYPE_REGISTRY[type]
  if (!definition) throw new Error(`Unknown node type: ${type}`)
  return {
    id,
    type,
    label: definition.label,
    position,
    size: getDefaultNodeSize(type),
    zIndex,
    bypassed: false,
    muted: false,
    locked: false,
    parameters: {
      ...getDefaultNodeParameters(type),
      ...(type === 'load-image'
        ? { assetDigest: null }
        : type === 'resize'
          ? {
              widthUnit: 'pixels',
              heightUnit: 'pixels',
              algorithmVersion: 'resize.v1',
            }
          : type === 'brightness-correction'
            ? { algorithmVersion: 'brightness.v1' }
            : type === 'color-correction'
              ? {
                  tint: [1, 1, 1],
                  algorithmVersion: 'color-correction.v1',
                }
              : {}),
    },
  }
}

function createsCycle(
  graph: GraphDocument,
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  const pending = [targetNodeId]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = pending.pop()!
    if (current === sourceNodeId) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const edge of graph.edges) {
      if (edge.sourceNodeId === current) pending.push(edge.targetNodeId)
    }
  }
  return false
}

export function connectGraph(
  graph: GraphDocument,
  edge: GraphEdge,
): ConnectionResult {
  const sourceNode = graph.nodes.find((node) => node.id === edge.sourceNodeId)
  const targetNode = graph.nodes.find((node) => node.id === edge.targetNodeId)
  if (!sourceNode || !targetNode)
    return { ok: false, diagnostic: 'missing-node' }

  const sourcePort = NODE_TYPE_REGISTRY[sourceNode.type]?.outputs.find(
    (port) => port.id === edge.sourcePortId,
  )
  const targetPort = NODE_TYPE_REGISTRY[targetNode.type]?.inputs.find(
    (port) => port.id === edge.targetPortId,
  )
  if (!sourcePort || !targetPort)
    return { ok: false, diagnostic: 'missing-port' }
  if (!targetPort.accepts.includes(sourcePort.dataType)) {
    return { ok: false, diagnostic: 'incompatible-type' }
  }
  if (
    graph.edges.some(
      (candidate) =>
        candidate.sourceNodeId === edge.sourceNodeId &&
        candidate.sourcePortId === edge.sourcePortId &&
        candidate.targetNodeId === edge.targetNodeId &&
        candidate.targetPortId === edge.targetPortId,
    )
  ) {
    return { ok: false, diagnostic: 'duplicate-edge' }
  }
  if (
    targetPort.cardinality !== 'variadic' &&
    graph.edges.some(
      (candidate) =>
        candidate.targetNodeId === edge.targetNodeId &&
        candidate.targetPortId === edge.targetPortId,
    )
  ) {
    return { ok: false, diagnostic: 'cardinality-exceeded' }
  }
  if (createsCycle(graph, edge.sourceNodeId, edge.targetNodeId)) {
    return { ok: false, diagnostic: 'cycle' }
  }

  return { ok: true, graph: { ...graph, edges: [...graph.edges, edge] } }
}
