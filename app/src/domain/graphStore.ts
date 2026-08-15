import { createStore } from 'zustand/vanilla'
import {
  connectGraph,
  createGraphNode,
  type ConnectionDiagnostic,
  type GraphDocument,
  type GraphEdge,
} from './graph'

export interface GraphStoreState {
  document: GraphDocument
  selectedNodeIds: readonly string[]
  undoStack: readonly GraphDocument[]
  redoStack: readonly GraphDocument[]
  connectionDiagnostic: ConnectionDiagnostic | null
  addNode(type: string, position: { x: number; y: number }, id?: string): string
  selectNode(id: string, additive?: boolean): void
  clearSelection(): void
  moveNode(id: string, position: { x: number; y: number }): void
  setNodeGeometry(
    id: string,
    geometry: { x: number; y: number; width: number; height: number },
  ): boolean
  moveSelectedBy(delta: { x: number; y: number }): void
  duplicateSelected(createId?: () => string): readonly string[]
  bringSelectedToFront(): void
  toggleSelectedState(state: 'bypassed' | 'muted' | 'locked'): void
  connectNodes(
    edge: Omit<GraphEdge, 'id' | 'order'>,
    id?: string,
  ): ConnectionDiagnostic | null
  replaceDocument(document: GraphDocument): void
  hydrateDocument(document: GraphDocument): void
  deleteSelected(): void
  undo(): void
  redo(): void
}

const EMPTY_DOCUMENT: GraphDocument = { nodes: [], edges: [] }
const BYPASS_DISABLED_TYPES = new Set([
  'load-image',
  'light',
  'representative-color',
])

function nextNodeId(): string {
  return `node-${crypto.randomUUID()}`
}

export function createGraphStore() {
  return createStore<GraphStoreState>((set, get) => ({
    document: EMPTY_DOCUMENT,
    selectedNodeIds: [],
    undoStack: [],
    redoStack: [],
    connectionDiagnostic: null,
    addNode(type, position, id = nextNodeId()) {
      const state = get()
      if (state.document.nodes.some((node) => node.id === id)) {
        throw new Error(`Duplicate node ID: ${id}`)
      }
      const node = createGraphNode(
        type,
        id,
        position,
        state.document.nodes.length,
      )
      set({
        document: {
          ...state.document,
          nodes: [...state.document.nodes, node],
        },
        selectedNodeIds: [id],
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
      return id
    },
    selectNode(id, additive = false) {
      const state = get()
      if (!state.document.nodes.some((node) => node.id === id)) return
      if (!additive) {
        set({ selectedNodeIds: [id] })
        return
      }
      set({
        selectedNodeIds: state.selectedNodeIds.includes(id)
          ? state.selectedNodeIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedNodeIds, id],
      })
    },
    clearSelection() {
      set({ selectedNodeIds: [] })
    },
    moveNode(id, position) {
      const state = get()
      const node = state.document.nodes.find((candidate) => candidate.id === id)
      if (
        !node ||
        node.locked ||
        (node.position.x === position.x && node.position.y === position.y)
      ) {
        return
      }
      set({
        document: {
          ...state.document,
          nodes: state.document.nodes.map((candidate) =>
            candidate.id === id ? { ...candidate, position } : candidate,
          ),
        },
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
    },
    setNodeGeometry(id, geometry) {
      const state = get()
      const node = state.document.nodes.find((candidate) => candidate.id === id)
      if (
        !node ||
        node.locked ||
        !Object.values(geometry).every(Number.isFinite) ||
        geometry.width < 180 ||
        geometry.width > 560 ||
        geometry.height < 96 ||
        geometry.height > 1200
      ) {
        return false
      }
      set({
        document: {
          ...state.document,
          nodes: state.document.nodes.map((candidate) =>
            candidate.id === id
              ? {
                  ...candidate,
                  position: { x: geometry.x, y: geometry.y },
                  size: { width: geometry.width, height: geometry.height },
                }
              : candidate,
          ),
        },
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
      return true
    },
    moveSelectedBy(delta) {
      const state = get()
      const selected = new Set(state.selectedNodeIds)
      const movable = state.document.nodes.filter(
        (node) => selected.has(node.id) && !node.locked,
      )
      if (movable.length === 0 || (delta.x === 0 && delta.y === 0)) return
      set({
        document: {
          ...state.document,
          nodes: state.document.nodes.map((node) =>
            selected.has(node.id) && !node.locked
              ? {
                  ...node,
                  position: {
                    x: node.position.x + delta.x,
                    y: node.position.y + delta.y,
                  },
                }
              : node,
          ),
        },
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
    },
    duplicateSelected(createId = nextNodeId) {
      const state = get()
      const selected = new Set(state.selectedNodeIds)
      const copies = state.document.nodes
        .filter((node) => selected.has(node.id))
        .map((node, index) => ({
          ...node,
          id: createId(),
          position: {
            x: node.position.x + node.size.width + 24,
            y: node.position.y,
          },
          zIndex: state.document.nodes.length + index,
        }))
      if (copies.length === 0) return []
      const copyIds = copies.map((node) => node.id)
      const copiedNodeIds = new Map(
        state.document.nodes
          .filter((node) => selected.has(node.id))
          .map((node, index) => [node.id, copies[index].id]),
      )
      const copiedEdges = state.document.edges
        .filter(
          (edge) =>
            copiedNodeIds.has(edge.sourceNodeId) &&
            copiedNodeIds.has(edge.targetNodeId),
        )
        .map((edge) => ({
          ...edge,
          id: createId(),
          sourceNodeId: copiedNodeIds.get(edge.sourceNodeId)!,
          targetNodeId: copiedNodeIds.get(edge.targetNodeId)!,
        }))
      set({
        document: {
          ...state.document,
          nodes: [...state.document.nodes, ...copies],
          edges: [...state.document.edges, ...copiedEdges],
        },
        selectedNodeIds: copyIds,
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
      return copyIds
    },
    bringSelectedToFront() {
      const state = get()
      const selected = new Set(state.selectedNodeIds)
      if (selected.size === 0) return
      const selectedNodes = state.document.nodes
        .filter((node) => selected.has(node.id))
        .sort(
          (left, right) =>
            left.zIndex - right.zIndex || left.id.localeCompare(right.id),
        )
      const maxZIndex = Math.max(
        -1,
        ...state.document.nodes.map((node) => node.zIndex),
      )
      const zIndexById = new Map(
        selectedNodes.map((node, index) => [node.id, maxZIndex + index + 1]),
      )
      set({
        document: {
          ...state.document,
          nodes: state.document.nodes.map((node) =>
            zIndexById.has(node.id)
              ? { ...node, zIndex: zIndexById.get(node.id)! }
              : node,
          ),
        },
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
    },
    toggleSelectedState(authoredState) {
      const state = get()
      const selected = new Set(state.selectedNodeIds)
      const eligible = state.document.nodes.filter(
        (node) =>
          selected.has(node.id) &&
          (authoredState !== 'bypassed' ||
            !BYPASS_DISABLED_TYPES.has(node.type)),
      )
      if (eligible.length === 0) return
      const nextValue = !eligible.every((node) => node[authoredState])
      const eligibleIds = new Set(eligible.map((node) => node.id))
      set({
        document: {
          ...state.document,
          nodes: state.document.nodes.map((node) =>
            eligibleIds.has(node.id)
              ? { ...node, [authoredState]: nextValue }
              : node,
          ),
        },
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
    },
    connectNodes(edge, id = `edge-${crypto.randomUUID()}`) {
      const state = get()
      const order = state.document.edges.filter(
        (candidate) =>
          candidate.targetNodeId === edge.targetNodeId &&
          candidate.targetPortId === edge.targetPortId,
      ).length
      const result = connectGraph(state.document, { ...edge, id, order })
      if (!result.ok) {
        set({ connectionDiagnostic: result.diagnostic })
        return result.diagnostic
      }
      set({
        document: result.graph,
        connectionDiagnostic: null,
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
      return null
    },
    replaceDocument(document) {
      const state = get()
      set({
        document,
        selectedNodeIds: [],
        connectionDiagnostic: null,
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
    },
    hydrateDocument(document) {
      set({
        document,
        selectedNodeIds: [],
        connectionDiagnostic: null,
        undoStack: [],
        redoStack: [],
      })
    },
    deleteSelected() {
      const state = get()
      if (state.selectedNodeIds.length === 0) return
      const selected = new Set(state.selectedNodeIds)
      const deleted = new Set(
        state.document.nodes
          .filter((node) => selected.has(node.id) && !node.locked)
          .map((node) => node.id),
      )
      if (deleted.size === 0) return
      const nextDocument: GraphDocument = {
        nodes: state.document.nodes.filter((node) => !deleted.has(node.id)),
        edges: state.document.edges.filter(
          (edge) =>
            !deleted.has(edge.sourceNodeId) && !deleted.has(edge.targetNodeId),
        ),
      }
      set({
        document: nextDocument,
        selectedNodeIds: state.selectedNodeIds.filter((id) => !deleted.has(id)),
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
        connectionDiagnostic: null,
      })
    },
    undo() {
      const state = get()
      const previous = state.undoStack.at(-1)
      if (!previous) return
      set({
        document: previous,
        selectedNodeIds: [],
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [state.document, ...state.redoStack],
        connectionDiagnostic: null,
      })
    },
    redo() {
      const state = get()
      const next = state.redoStack[0]
      if (!next) return
      set({
        document: next,
        selectedNodeIds: [],
        undoStack: [...state.undoStack, state.document],
        redoStack: state.redoStack.slice(1),
        connectionDiagnostic: null,
      })
    },
  }))
}
