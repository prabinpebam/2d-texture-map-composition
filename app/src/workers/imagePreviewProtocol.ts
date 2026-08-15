export const IMAGE_PREVIEW_PROTOCOL_VERSION = 1 as const

export type PreviewMaskSource =
  'luminosity' | 'alpha' | 'red' | 'green' | 'blue'

export interface ImagePreviewRequest {
  protocolVersion: typeof IMAGE_PREVIEW_PROTOCOL_VERSION
  type: 'render-preview'
  requestId: string
  nodeId: string
  generation: number
  cacheKey: string
  blob: Blob
  mode: 'color' | 'mask'
  maskSource: PreviewMaskSource
  invert: boolean
  maxLongEdge: number
}

export type ImagePreviewResponse =
  | {
      protocolVersion: typeof IMAGE_PREVIEW_PROTOCOL_VERSION
      type: 'preview-result'
      requestId: string
      nodeId: string
      generation: number
      width: number
      height: number
      sourceWidth: number
      sourceHeight: number
      pixels: ArrayBuffer
      sample: readonly [number, number, number, number]
      cacheHit: boolean
    }
  | {
      protocolVersion: typeof IMAGE_PREVIEW_PROTOCOL_VERSION
      type: 'preview-canceled' | 'preview-failure'
      requestId: string
      nodeId: string
      generation: number
      diagnostic?: string
    }

export function isImagePreviewRequest(
  value: unknown,
): value is ImagePreviewRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.protocolVersion === IMAGE_PREVIEW_PROTOCOL_VERSION &&
    candidate.type === 'render-preview' &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.nodeId === 'string' &&
    Number.isSafeInteger(candidate.generation) &&
    typeof candidate.cacheKey === 'string' &&
    candidate.cacheKey.length > 0 &&
    candidate.blob instanceof Blob &&
    (candidate.mode === 'color' || candidate.mode === 'mask') &&
    ['luminosity', 'alpha', 'red', 'green', 'blue'].includes(
      String(candidate.maskSource),
    ) &&
    typeof candidate.invert === 'boolean' &&
    Number.isSafeInteger(candidate.maxLongEdge) &&
    Number(candidate.maxLongEdge) > 0 &&
    Number(candidate.maxLongEdge) <= 2048
  )
}
