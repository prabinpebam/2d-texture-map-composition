export const IMAGE_PREVIEW_PROTOCOL_VERSION = 1 as const

export type PreviewMaskSource =
  'luminosity' | 'alpha' | 'red' | 'green' | 'blue'

export type PreviewOperation =
  | {
      type: 'resize'
      width: number
      height: number
      kernel: string
    }
  | {
      type: 'brightness'
      exposure: number
      highlights: number
      shadows: number
      whites: number
      blacks: number
    }
  | {
      type: 'color-correction'
      temperature: number
      greenMagenta: number
      hueDegrees: number
      saturation: number
      tint: readonly [number, number, number]
      tintMix: number
    }

export interface RenderImagePreviewRequest {
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
  operations: readonly PreviewOperation[]
}

export interface CancelImagePreviewRequest {
  protocolVersion: typeof IMAGE_PREVIEW_PROTOCOL_VERSION
  type: 'cancel-preview'
  requestId: string
  nodeId: string
  generation: number
}

export type ImagePreviewRequest =
  RenderImagePreviewRequest | CancelImagePreviewRequest

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
  const common =
    candidate.protocolVersion === IMAGE_PREVIEW_PROTOCOL_VERSION &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.nodeId === 'string' &&
    Number.isSafeInteger(candidate.generation)
  if (!common) return false
  if (candidate.type === 'cancel-preview') return true
  return (
    candidate.type === 'render-preview' &&
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
    Number(candidate.maxLongEdge) <= 2048 &&
    Array.isArray(candidate.operations) &&
    candidate.operations.length <= 64
  )
}
