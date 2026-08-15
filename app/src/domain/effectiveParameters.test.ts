import { describe, expect, it } from 'vitest'
import { connectGraph, createGraphNode, type GraphDocument } from './graph'
import { resolveEffectiveParameters } from './effectiveParameters'

function connect(
  document: GraphDocument,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
) {
  const result = connectGraph(document, {
    id: `${sourceNodeId}-${targetNodeId}-${targetPortId}`,
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
    order: 0,
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostic)
  return result.graph
}

describe('externally driven widget values', () => {
  it('overrides effective execution without mutating manual fallback', () => {
    const integer = createGraphNode(
      'integer-value',
      'integer',
      { x: 0, y: 0 },
      0,
    )
    integer.parameters = { ...integer.parameters, value: 512 }
    const resize = createGraphNode('resize', 'resize', { x: 0, y: 0 }, 1)
    resize.parameters = { ...resize.parameters, width: 1024 }
    const document = connect(
      { nodes: [integer, resize], edges: [] },
      'integer',
      'integer',
      'resize',
      'parameter:width',
    )

    expect(resolveEffectiveParameters(document, 'resize').width).toBe(512)
    expect(
      document.nodes.find((node) => node.id === 'resize')?.parameters,
    ).toMatchObject({ width: 1024 })
    expect(
      resolveEffectiveParameters({ ...document, edges: [] }, 'resize').width,
    ).toBe(1024)
  })

  it('resolves chained primitive fallback values without mutation', () => {
    const first = createGraphNode('number-value', 'first', { x: 0, y: 0 }, 0)
    first.parameters = { ...first.parameters, value: 0.75 }
    const second = createGraphNode('number-value', 'second', { x: 0, y: 0 }, 1)
    second.parameters = { ...second.parameters, value: 0.25 }
    const brightness = createGraphNode(
      'brightness-correction',
      'brightness',
      { x: 0, y: 0 },
      2,
    )
    let document: GraphDocument = {
      nodes: [first, second, brightness],
      edges: [],
    }
    document = connect(document, 'first', 'float', 'second', 'parameter:value')
    document = connect(
      document,
      'second',
      'float',
      'brightness',
      'parameter:exposure',
    )

    expect(resolveEffectiveParameters(document, 'brightness').exposure).toBe(
      0.75,
    )
    expect(second.parameters?.value).toBe(0.25)
  })
})
