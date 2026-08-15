import { createStore } from 'zustand/vanilla'
import { createGraphNode, type GraphDocument } from './graph'

export interface GraphStoreState {
  document: GraphDocument
  selectedNodeIds: readonly string[]
  undoStack: readonly GraphDocument[]
  redoStack: readonly GraphDocument[]
  addNode(type: string, position: { x: number; y: number }, id?: string): string
  selectNode(id: string, additive?: boolean): void
  clearSelection(): void
  moveNode(id: string, position: { x: number; y: number }): void
  moveSelectedBy(delta: { x: number; y: number }): void
  duplicateSelected(createId?: () => string): readonly string[]
  toggleSelectedState(state: 'bypassed' | 'muted' | 'locked'): void
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
      set({
        document: {
          ...state.document,
          nodes: [...state.document.nodes, ...copies],
        },
        selectedNodeIds: copyIds,
        undoStack: [...state.undoStack, state.document],
        redoStack: [],
      })
      return copyIds
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
      })
    },
  }))
}
