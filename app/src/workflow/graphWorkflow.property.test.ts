import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createGraphNode, type GraphDocument } from '../domain/graph'
import { parseGraphWorkflow, serializeGraphWorkflow } from './graphWorkflow'

const project = {
  id: 'property-project',
  name: 'Generated graph',
  viewport: { x: 0, y: 0, zoom: 1 },
}

describe('graph workflow properties', () => {
  it('round-trips generated acyclic resize chains exactly', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (nodeCount) => {
        const nodes = Array.from({ length: nodeCount }, (_, index) =>
          createGraphNode(
            'resize',
            `node-${index}`,
            { x: (index % 10) * 264, y: Math.floor(index / 10) * 152 },
            index,
          ),
        )
        const edges = Array.from(
          { length: Math.max(0, nodeCount - 1) },
          (_, index) => ({
            id: `edge-${index}`,
            sourceNodeId: `node-${index}`,
            sourcePortId: 'output',
            targetNodeId: `node-${index + 1}`,
            targetPortId: 'input',
            order: 0,
          }),
        )
        const document: GraphDocument = { nodes, edges }
        const result = parseGraphWorkflow(
          serializeGraphWorkflow(document, project),
        )
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.document).toEqual(document)
      }),
    )
  })

  it('validates a 300-node, 299-edge authored stress graph', () => {
    const nodes = Array.from({ length: 300 }, (_, index) =>
      createGraphNode(
        'resize',
        `stress-${index}`,
        { x: (index % 20) * 264, y: Math.floor(index / 20) * 152 },
        index,
      ),
    )
    const edges = Array.from({ length: 299 }, (_, index) => ({
      id: `stress-edge-${index}`,
      sourceNodeId: `stress-${index}`,
      sourcePortId: 'output',
      targetNodeId: `stress-${index + 1}`,
      targetPortId: 'input',
      order: 0,
    }))
    const document: GraphDocument = { nodes, edges }
    const started = performance.now()
    const result = parseGraphWorkflow(serializeGraphWorkflow(document, project))
    const elapsedMilliseconds = performance.now() - started

    expect(result.ok).toBe(true)
    expect(elapsedMilliseconds).toBeLessThan(500)
  })
})
