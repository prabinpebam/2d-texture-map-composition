import { describe, expect, it } from 'vitest'
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
})
