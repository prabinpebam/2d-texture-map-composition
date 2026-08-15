import { describe, expect, it } from 'vitest'
import { connectGraph, createGraphNode, type GraphDocument } from './graph'

function graphWith(...types: string[]): GraphDocument {
  return {
    nodes: types.map((type, index) =>
      createGraphNode(type, `node-${index}`, { x: index * 260, y: 0 }, index),
    ),
    edges: [],
  }
}

describe('typed graph domain', () => {
  it('creates canonical nodes with stable authored defaults', () => {
    expect(
      createGraphNode('load-image', 'source', { x: 12, y: 24 }, 3),
    ).toMatchObject({
      id: 'source',
      type: 'load-image',
      label: 'Load image',
      position: { x: 12, y: 24 },
      size: { width: 240, height: 128 },
      zIndex: 3,
      bypassed: false,
      muted: false,
      locked: false,
    })
  })

  it('connects compatible ports and rejects incompatible types', () => {
    const graph = graphWith('load-image', 'preview', 'light')
    const valid = connectGraph(graph, {
      id: 'edge-1',
      sourceNodeId: 'node-0',
      sourcePortId: 'image',
      targetNodeId: 'node-1',
      targetPortId: 'image',
      order: 0,
    })
    expect(valid.ok).toBe(true)

    expect(
      connectGraph(graph, {
        id: 'edge-2',
        sourceNodeId: 'node-2',
        sourcePortId: 'light',
        targetNodeId: 'node-1',
        targetPortId: 'image',
        order: 0,
      }),
    ).toEqual({ ok: false, diagnostic: 'incompatible-type' })
  })

  it('rejects cycles before mutating the graph', () => {
    let graph = graphWith('resize', 'color-correction')
    const first = connectGraph(graph, {
      id: 'edge-1',
      sourceNodeId: 'node-0',
      sourcePortId: 'output',
      targetNodeId: 'node-1',
      targetPortId: 'image',
      order: 0,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    graph = first.graph

    expect(
      connectGraph(graph, {
        id: 'edge-2',
        sourceNodeId: 'node-1',
        sourcePortId: 'image',
        targetNodeId: 'node-0',
        targetPortId: 'input',
        order: 0,
      }),
    ).toEqual({ ok: false, diagnostic: 'cycle' })
    expect(graph.edges).toHaveLength(1)
  })
})
