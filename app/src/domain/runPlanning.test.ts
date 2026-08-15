import { describe, expect, it } from 'vitest'
import { createGraphNode, type GraphDocument } from './graph'
import { planRun } from './runPlanning'

function node(type: string, id: string, zIndex: number) {
  return createGraphNode(type, id, { x: zIndex * 100, y: 0 }, zIndex)
}

const branchedGraph: GraphDocument = {
  nodes: [
    node('load-image', 'source-a', 0),
    node('resize', 'resize-a', 1),
    node('preview', 'preview-a', 2),
    node('load-image', 'source-b', 3),
    node('brightness-correction', 'brightness-b', 4),
    node('preview', 'preview-b', 5),
  ],
  edges: [
    {
      id: 'a-1',
      sourceNodeId: 'source-a',
      sourcePortId: 'image',
      targetNodeId: 'resize-a',
      targetPortId: 'input',
      order: 0,
    },
    {
      id: 'a-2',
      sourceNodeId: 'resize-a',
      sourcePortId: 'output',
      targetNodeId: 'preview-a',
      targetPortId: 'image',
      order: 0,
    },
    {
      id: 'b-1',
      sourceNodeId: 'source-b',
      sourcePortId: 'image',
      targetNodeId: 'brightness-b',
      targetPortId: 'image',
      order: 0,
    },
    {
      id: 'b-2',
      sourceNodeId: 'brightness-b',
      sourcePortId: 'image',
      targetNodeId: 'preview-b',
      targetPortId: 'image',
      order: 0,
    },
  ],
}

describe('explicit run planning', () => {
  it('demands every active output branch for a full run', () => {
    expect(planRun(branchedGraph)).toEqual({
      ok: true,
      plan: {
        targetOutputIds: ['preview-a', 'preview-b'],
        demandedNodeIds: [
          'source-a',
          'resize-a',
          'preview-a',
          'source-b',
          'brightness-b',
          'preview-b',
        ],
      },
    })
  })

  it('demands only ancestors of the selected output for a partial run', () => {
    expect(planRun(branchedGraph, ['preview-b'])).toEqual({
      ok: true,
      plan: {
        targetOutputIds: ['preview-b'],
        demandedNodeIds: ['source-b', 'brightness-b', 'preview-b'],
      },
    })
  })

  it('rejects a demanded branch with a missing required input', () => {
    const incomplete: GraphDocument = {
      nodes: [node('preview', 'preview', 0)],
      edges: [],
    }
    expect(planRun(incomplete)).toEqual({
      ok: false,
      diagnostic: {
        code: 'missing-required-input',
        nodeId: 'preview',
        portId: 'image',
      },
    })
  })
})
