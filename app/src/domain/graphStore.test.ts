import { describe, expect, it } from 'vitest'
import { createGraphNode } from './graph'
import { createGraphStore } from './graphStore'

describe('graph command store', () => {
  it('adds a selected node and restores exact authored state with undo and redo', () => {
    const store = createGraphStore()
    store.getState().addNode('load-image', { x: 100, y: 80 }, 'source')

    expect(store.getState().document.nodes).toHaveLength(1)
    expect(store.getState().selectedNodeIds).toEqual(['source'])
    store.getState().undo()
    expect(store.getState().document.nodes).toEqual([])
    expect(store.getState().selectedNodeIds).toEqual([])
    store.getState().redo()
    expect(store.getState().document.nodes[0]).toMatchObject({ id: 'source' })
  })

  it('keeps selection changes out of authored history', () => {
    const store = createGraphStore()
    store.getState().addNode('light', { x: 0, y: 0 }, 'light-a')
    const historyLength = store.getState().undoStack.length

    store.getState().clearSelection()
    store.getState().selectNode('light-a')
    expect(store.getState().undoStack).toHaveLength(historyLength)
  })

  it('deletes selected unlocked nodes and restores them with undo', () => {
    const store = createGraphStore()
    store.getState().addNode('load-image', { x: 0, y: 0 }, 'source')
    store.getState().deleteSelected()
    expect(store.getState().document.nodes).toHaveLength(0)

    store.getState().undo()
    expect(store.getState().document.nodes[0]).toMatchObject({ id: 'source' })
  })

  it('moves unlocked nodes as one authored command and leaves locked nodes fixed', () => {
    const store = createGraphStore()
    store.getState().addNode('resize', { x: 10, y: 20 }, 'resize-a')
    store.getState().moveSelectedBy({ x: 10, y: -5 })
    expect(store.getState().document.nodes[0].position).toEqual({
      x: 20,
      y: 15,
    })

    store.getState().toggleSelectedState('locked')
    store.getState().moveSelectedBy({ x: 100, y: 100 })
    expect(store.getState().document.nodes[0].position).toEqual({
      x: 20,
      y: 15,
    })
  })

  it('duplicates selected nodes and toggles supported authored states', () => {
    const store = createGraphStore()
    store.getState().addNode('resize', { x: 0, y: 0 }, 'resize-a')
    const ids = ['resize-copy']
    expect(store.getState().duplicateSelected(() => ids.shift()!)).toEqual([
      'resize-copy',
    ])
    expect(store.getState().selectedNodeIds).toEqual(['resize-copy'])
    expect(store.getState().document.nodes[1].position).toEqual({
      x: 264,
      y: 0,
    })

    store.getState().toggleSelectedState('bypassed')
    store.getState().toggleSelectedState('muted')
    expect(store.getState().document.nodes[1]).toMatchObject({
      bypassed: true,
      muted: true,
    })
  })

  it('does not bypass source nodes or delete selected locked nodes and edges', () => {
    const store = createGraphStore()
    store.getState().addNode('load-image', { x: 0, y: 0 }, 'source')
    store.getState().toggleSelectedState('bypassed')
    expect(store.getState().document.nodes[0].bypassed).toBe(false)

    store.getState().toggleSelectedState('locked')
    const historyLength = store.getState().undoStack.length
    store.getState().deleteSelected()
    expect(store.getState().document.nodes).toHaveLength(1)
    expect(store.getState().undoStack).toHaveLength(historyLength)
  })

  it('creates validated edges and exposes rejections without authored mutation', () => {
    const store = createGraphStore()
    store.getState().addNode('load-image', { x: 0, y: 0 }, 'source')
    store.getState().addNode('preview', { x: 300, y: 0 }, 'preview')
    expect(
      store.getState().connectNodes(
        {
          sourceNodeId: 'source',
          sourcePortId: 'image',
          targetNodeId: 'preview',
          targetPortId: 'image',
        },
        'edge-valid',
      ),
    ).toBeNull()
    expect(store.getState().document.edges).toHaveLength(1)

    const before = store.getState().document
    expect(
      store.getState().connectNodes(
        {
          sourceNodeId: 'source',
          sourcePortId: 'image',
          targetNodeId: 'preview',
          targetPortId: 'image',
        },
        'edge-invalid',
      ),
    ).toBe('duplicate-edge')
    expect(store.getState().document).toBe(before)
    expect(store.getState().connectionDiagnostic).toBe('duplicate-edge')
  })

  it('replaces an imported document as one undoable command', () => {
    const store = createGraphStore()
    const imported = {
      nodes: [createGraphNode('light', 'imported', { x: 20, y: 30 }, 0)],
      edges: [],
    }
    store.getState().replaceDocument(imported)
    expect(store.getState().document).toBe(imported)

    store.getState().undo()
    expect(store.getState().document).toEqual({ nodes: [], edges: [] })
  })
})
