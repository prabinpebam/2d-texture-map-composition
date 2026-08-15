import type { GraphDocument } from '../domain/graph'
import { resolveEffectiveParameters } from '../domain/effectiveParameters'
import { encodedSrgbToLinear } from './transformCatalog'
import {
  cancelImageAssetPreview,
  renderImageAssetPreview,
  type ImageAssetPreview,
  type PreviewOperation,
} from './imageAssets'
import type { PreviewMaskSource } from '../workers/imagePreviewProtocol'

export interface PreviewBranch {
  outputNodeId: string
  sourceNodeId: string
  digest: string
  mode: 'color' | 'mask'
  maskSource: PreviewMaskSource
  invert: boolean
  operations: readonly PreviewOperation[]
  cacheKey: string
}

export function resolveSourcePreviewBranch(
  document: GraphDocument,
  nodeId: string,
): PreviewBranch | null {
  const node = document.nodes.find((candidate) => candidate.id === nodeId)
  if (!node || node.type !== 'load-image') return null
  const parameters = resolveEffectiveParameters(document, nodeId)
  const digest = parameters.assetDigest
  if (typeof digest !== 'string' || !digest) return null
  return {
    outputNodeId: nodeId,
    sourceNodeId: nodeId,
    digest,
    mode: 'color',
    maskSource: 'luminosity',
    invert: false,
    operations: [],
    cacheKey: `${digest}:source-thumbnail-v1`,
  }
}

export function resolvePreviewBranch(
  document: GraphDocument,
  outputNodeId: string,
): PreviewBranch | null {
  let currentNode = document.nodes.find((node) => node.id === outputNodeId)
  if (!currentNode || currentNode.type !== 'preview') return null
  const reversedOperations: PreviewOperation[] = []
  const visited = new Set<string>()
  while (!visited.has(currentNode.id)) {
    visited.add(currentNode.id)
    const edge = document.edges.find(
      (candidate) =>
        candidate.targetNodeId === currentNode!.id &&
        !candidate.targetPortId.startsWith('parameter:'),
    )
    if (!edge) return null
    const source = document.nodes.find(
      (candidate) => candidate.id === edge.sourceNodeId,
    )
    if (!source) return null
    const parameters = resolveEffectiveParameters(document, source.id)
    if (source.type === 'load-image') {
      const digest = parameters.assetDigest
      if (typeof digest !== 'string' || !digest) return null
      const sourceValue = parameters.maskSource
      const maskSource: PreviewMaskSource =
        sourceValue === 'alpha' ||
        sourceValue === 'red' ||
        sourceValue === 'green' ||
        sourceValue === 'blue'
          ? sourceValue
          : 'luminosity'
      const mode = parameters.mode === 'mask' ? 'mask' : 'color'
      const invert = parameters.invert === true
      const operations = reversedOperations.reverse()
      return {
        outputNodeId,
        sourceNodeId: source.id,
        digest,
        mode,
        maskSource,
        invert,
        operations,
        cacheKey: [
          digest,
          mode,
          maskSource,
          invert ? 'invert' : 'normal',
          JSON.stringify(operations),
        ].join(':'),
      }
    }
    if (source.type === 'resize') {
      reversedOperations.push({
        type: 'resize',
        width: Number(parameters.width ?? 1),
        height: Number(parameters.height ?? 1),
        kernel: String(parameters.resolvedKernel ?? 'mitchell.v1'),
      })
    } else if (source.type === 'brightness-correction') {
      reversedOperations.push({
        type: 'brightness',
        exposure: Number(parameters.exposure ?? 0),
        highlights: Number(parameters.highlights ?? 0),
        shadows: Number(parameters.shadows ?? 0),
        whites: Number(parameters.whites ?? 0),
        blacks: Number(parameters.blacks ?? 0),
      })
    } else if (source.type === 'color-correction') {
      const tintHex = String(parameters.tintHex ?? '#ffffff')
      const tint = [1, 3, 5].map((offset) =>
        encodedSrgbToLinear(
          Number.parseInt(tintHex.slice(offset, offset + 2), 16) / 255,
        ),
      )
      reversedOperations.push({
        type: 'color-correction',
        temperature: Number(parameters.temperature ?? 0),
        greenMagenta: Number(parameters.greenMagenta ?? 0),
        hueDegrees: Number(parameters.hueDegrees ?? 0),
        saturation: Number(parameters.saturation ?? 0),
        tint: [
          Number(tint[0] ?? 1),
          Number(tint[1] ?? 1),
          Number(tint[2] ?? 1),
        ],
        tintMix: Number(parameters.tintMix ?? 0),
      })
    } else {
      return null
    }
    currentNode = source
  }
  return null
}

export function renderPreviewBranch(
  projectId: string,
  branch: PreviewBranch,
  executionNodeId = branch.outputNodeId,
): Promise<ImageAssetPreview> {
  return renderImageAssetPreview(projectId, executionNodeId, branch.digest, {
    mode: branch.mode,
    maskSource: branch.maskSource,
    invert: branch.invert,
    operations: branch.operations,
  })
}

export function cancelPreviewBranch(executionNodeId: string) {
  cancelImageAssetPreview(executionNodeId)
}
