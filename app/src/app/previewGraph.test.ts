import { describe, expect, it } from 'vitest'
import { createGraphNode, type GraphDocument } from '../domain/graph'
import { resolvePreviewBranch } from './previewGraph'

function node(type: string, id: string, zIndex: number) {
  return createGraphNode(type, id, { x: zIndex * 100, y: 0 }, zIndex)
}

describe('per-output preview branches', () => {
  it('resolves independent sources and operation chains for two outputs', () => {
    const sourceA = node('load-image', 'source-a', 0)
    sourceA.parameters = { ...sourceA.parameters, assetDigest: 'digest-a' }
    const resizeA = node('resize', 'resize-a', 1)
    resizeA.parameters = {
      ...resizeA.parameters,
      width: 32,
      height: 16,
      resolvedKernel: 'nearest.v1',
    }
    const previewA = node('preview', 'preview-a', 2)
    const sourceB = node('load-image', 'source-b', 3)
    sourceB.parameters = { ...sourceB.parameters, assetDigest: 'digest-b' }
    const previewB = node('preview', 'preview-b', 4)
    const document: GraphDocument = {
      nodes: [sourceA, resizeA, previewA, sourceB, previewB],
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
          targetNodeId: 'preview-b',
          targetPortId: 'image',
          order: 0,
        },
      ],
    }

    expect(resolvePreviewBranch(document, 'preview-a')).toMatchObject({
      digest: 'digest-a',
      operations: [
        {
          type: 'resize',
          width: 32,
          height: 16,
          kernel: 'nearest.v1',
        },
      ],
    })
    expect(resolvePreviewBranch(document, 'preview-b')).toMatchObject({
      digest: 'digest-b',
      operations: [],
    })
  })

  it('uses driven parameter values in operations and cache identity', () => {
    const source = node('load-image', 'source', 0)
    source.parameters = { ...source.parameters, assetDigest: 'digest-a' }
    const integer = node('integer-value', 'integer', 1)
    integer.parameters = { ...integer.parameters, value: 64 }
    const resize = node('resize', 'resize', 2)
    resize.parameters = { ...resize.parameters, width: 1024, height: 32 }
    const preview = node('preview', 'preview', 3)
    const document: GraphDocument = {
      nodes: [source, integer, resize, preview],
      edges: [
        {
          id: 'parameter-width',
          sourceNodeId: 'integer',
          sourcePortId: 'integer',
          targetNodeId: 'resize',
          targetPortId: 'parameter:width',
          order: 0,
        },
        {
          id: 'image-resize',
          sourceNodeId: 'source',
          sourcePortId: 'image',
          targetNodeId: 'resize',
          targetPortId: 'input',
          order: 0,
        },
        {
          id: 'resize-preview',
          sourceNodeId: 'resize',
          sourcePortId: 'output',
          targetNodeId: 'preview',
          targetPortId: 'image',
          order: 0,
        },
      ],
    }

    const branch = resolvePreviewBranch(document, 'preview')
    expect(branch?.operations[0]).toMatchObject({ width: 64, height: 32 })
    expect(branch?.cacheKey).toContain('"width":64')
    expect(resize.parameters?.width).toBe(1024)
  })
})
