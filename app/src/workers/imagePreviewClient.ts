import {
  IMAGE_PREVIEW_PROTOCOL_VERSION,
  type ImagePreviewRequest,
  type ImagePreviewResponse,
  type PreviewMaskSource,
  type PreviewOperation,
} from './imagePreviewProtocol'

export interface ImagePreviewResult {
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  pixels: ArrayBuffer
  sample: readonly [number, number, number, number]
  generation: number
  cacheHit: boolean
}

interface PendingPreview {
  nodeId: string
  resolve(result: ImagePreviewResult): void
  reject(error: Error): void
}

export class ImagePreviewClient {
  private readonly workers: Worker[]
  private readonly generations = new Map<string, number>()
  private readonly pending = new Map<string, PendingPreview>()
  private readonly nodeWorkers = new Map<string, number>()
  private nextWorker = 0

  constructor() {
    const workerCount = Math.min(
      2,
      Math.max(1, (navigator.hardwareConcurrency ?? 2) - 1),
    )
    this.workers = Array.from({ length: workerCount }, (_, index) => {
      const worker = new Worker(
        new URL('./imagePreview.worker.ts', import.meta.url),
        { name: `textureflow-image-preview-${index + 1}`, type: 'module' },
      )
      worker.addEventListener(
        'message',
        (event: MessageEvent<ImagePreviewResponse>) => {
          const response = event.data
          const pending = this.pending.get(response.requestId)
          if (!pending) return
          this.pending.delete(response.requestId)
          if (response.type === 'preview-result') {
            pending.resolve(response)
          } else {
            pending.reject(
              new Error(
                response.type === 'preview-canceled'
                  ? 'Preview superseded'
                  : (response.diagnostic ?? 'Preview failed'),
              ),
            )
          }
        },
      )
      return worker
    })
  }

  render(
    nodeId: string,
    blob: Blob,
    settings: {
      mode: 'color' | 'mask'
      maskSource: PreviewMaskSource
      invert: boolean
      maxLongEdge?: number
      cacheKey: string
      operations: readonly PreviewOperation[]
    },
  ): Promise<ImagePreviewResult> {
    const generation = (this.generations.get(nodeId) ?? 0) + 1
    this.generations.set(nodeId, generation)
    const requestId = crypto.randomUUID()
    const request: ImagePreviewRequest = {
      protocolVersion: IMAGE_PREVIEW_PROTOCOL_VERSION,
      type: 'render-preview',
      requestId,
      nodeId,
      generation,
      cacheKey: settings.cacheKey,
      blob,
      mode: settings.mode,
      maskSource: settings.maskSource,
      invert: settings.invert,
      maxLongEdge: settings.maxLongEdge ?? 1024,
      operations: settings.operations,
    }
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { nodeId, resolve, reject })
      let workerIndex = this.nodeWorkers.get(nodeId)
      if (workerIndex === undefined) {
        workerIndex = this.nextWorker
        this.nextWorker = (this.nextWorker + 1) % this.workers.length
        this.nodeWorkers.set(nodeId, workerIndex)
      }
      this.workers[workerIndex].postMessage(request)
    })
  }

  cancel(nodeId: string) {
    const generation = (this.generations.get(nodeId) ?? 0) + 1
    this.generations.set(nodeId, generation)
    for (const [requestId, pending] of this.pending) {
      if (pending.nodeId !== nodeId) continue
      this.pending.delete(requestId)
      pending.reject(new Error('Preview canceled'))
    }
    const workerIndex = this.nodeWorkers.get(nodeId)
    if (workerIndex === undefined) return
    this.workers[workerIndex].postMessage({
      protocolVersion: IMAGE_PREVIEW_PROTOCOL_VERSION,
      type: 'cancel-preview',
      requestId: crypto.randomUUID(),
      nodeId,
      generation,
    } satisfies ImagePreviewRequest)
  }
}

let imagePreviewClient: ImagePreviewClient | null = null

export function getImagePreviewClient(): ImagePreviewClient {
  imagePreviewClient ??= new ImagePreviewClient()
  return imagePreviewClient
}

export function cancelImagePreview(nodeId: string) {
  imagePreviewClient?.cancel(nodeId)
}
