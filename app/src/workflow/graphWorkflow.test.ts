import { describe, expect, it } from 'vitest'
import {
  connectGraph,
  createGraphNode,
  type GraphDocument,
} from '../domain/graph'
import { parseGraphWorkflow, serializeGraphWorkflow } from './graphWorkflow'

const project = {
  id: 'project-1',
  name: 'Round trip',
  viewport: { x: 12, y: 24, zoom: 1.25 },
}

function connectedDocument(): GraphDocument {
  const graph: GraphDocument = {
    nodes: [
      createGraphNode('load-image', 'source', { x: 10, y: 20 }, 0),
      createGraphNode('preview', 'preview', { x: 300, y: 20 }, 1),
    ],
    edges: [],
  }
  const result = connectGraph(graph, {
    id: 'edge-1',
    sourceNodeId: 'source',
    sourcePortId: 'image',
    targetNodeId: 'preview',
    targetPortId: 'image',
    order: 0,
  })
  if (!result.ok) throw new Error(result.diagnostic)
  return result.graph
}

describe('graph workflow v1', () => {
  it('round-trips authored graph state exactly through schema and semantics', () => {
    const original = connectedDocument()
    const result = parseGraphWorkflow(serializeGraphWorkflow(original, project))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.workflow.project).toEqual(project)
    expect(result.document).toEqual(original)
  })

  it('rejects schema-invalid and unknown node records', () => {
    expect(parseGraphWorkflow('{')).toEqual({
      ok: false,
      error: 'Workflow is not valid JSON',
    })
    const workflow = JSON.parse(
      serializeGraphWorkflow(connectedDocument(), project),
    )
    workflow.nodes[0].type = 'unknown'
    expect(parseGraphWorkflow(JSON.stringify(workflow))).toEqual({
      ok: false,
      error: 'Unknown node type: unknown',
    })
  })

  it('rejects semantic cycles after schema validation', () => {
    const first = createGraphNode('resize', 'first', { x: 0, y: 0 }, 0)
    const second = createGraphNode('resize', 'second', { x: 300, y: 0 }, 1)
    const cyclic: GraphDocument = {
      nodes: [first, second],
      edges: [
        {
          id: 'forward',
          sourceNodeId: 'first',
          sourcePortId: 'output',
          targetNodeId: 'second',
          targetPortId: 'input',
          order: 0,
        },
        {
          id: 'backward',
          sourceNodeId: 'second',
          sourcePortId: 'output',
          targetNodeId: 'first',
          targetPortId: 'input',
          order: 0,
        },
      ],
    }
    expect(parseGraphWorkflow(serializeGraphWorkflow(cyclic, project))).toEqual(
      { ok: false, error: 'Invalid edge backward: cycle' },
    )
  })
})
