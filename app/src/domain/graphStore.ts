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
  deleteSelected(): void
  undo(): void
  redo(): void
}

const EMPTY_DOCUMENT: GraphDocument = { nodes: [], edges: [] }

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
    deleteSelected() {
      const state = get()
      if (state.selectedNodeIds.length === 0) return
      const selected = new Set(state.selectedNodeIds)
      const nextDocument: GraphDocument = {
        nodes: state.document.nodes.filter(
          (node) => !selected.has(node.id) || node.locked,
        ),
        edges: state.document.edges.filter(
          (edge) =>
            !selected.has(edge.sourceNodeId) &&
            !selected.has(edge.targetNodeId),
        ),
      }
      if (nextDocument.nodes.length === state.document.nodes.length) return
      set({
        document: nextDocument,
        selectedNodeIds: [],
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
