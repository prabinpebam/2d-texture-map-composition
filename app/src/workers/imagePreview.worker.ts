/// <reference lib="webworker" />

import { encodedSrgbToLinear } from '../processing/scalar'
import { sniffImageFile } from '../processing/imageSniffer'
import {
  IMAGE_PREVIEW_PROTOCOL_VERSION,
  isImagePreviewRequest,
  type ImagePreviewRequest,
  type ImagePreviewResponse,
} from './imagePreviewProtocol'

const workerScope: DedicatedWorkerGlobalScope =
  self as DedicatedWorkerGlobalScope
const latestGeneration = new Map<string, number>()
const MAX_DECODE_BYTES = 256 * 1024 * 1024
const MAX_CACHE_BYTES = 32 * 1024 * 1024

interface CachedPreview {
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  pixels: Uint8ClampedArray
  sample: readonly [number, number, number, number]
}

const previewCache = new Map<string, CachedPreview>()
let previewCacheBytes = 0

function cachePreview(key: string, preview: CachedPreview) {
  const existing = previewCache.get(key)
  if (existing) previewCacheBytes -= existing.pixels.byteLength
  previewCache.delete(key)
  previewCache.set(key, preview)
  previewCacheBytes += preview.pixels.byteLength
  while (previewCacheBytes > MAX_CACHE_BYTES) {
    const oldestKey = previewCache.keys().next().value as string | undefined
    if (!oldestKey) break
    const oldest = previewCache.get(oldestKey)!
    previewCache.delete(oldestKey)
    previewCacheBytes -= oldest.pixels.byteLength
  }
}

function getCachedPreview(key: string) {
  const preview = previewCache.get(key)
  if (!preview) return null
  previewCache.delete(key)
  previewCache.set(key, preview)
  return preview
}

function maskValue(
  red: number,
  green: number,
  blue: number,
  alpha: number,
  request: ImagePreviewRequest,
) {
  let value: number
  if (request.maskSource === 'alpha') value = alpha / 255
  else {
    const linearRed = encodedSrgbToLinear(red / 255)
    const linearGreen = encodedSrgbToLinear(green / 255)
    const linearBlue = encodedSrgbToLinear(blue / 255)
    value =
      request.maskSource === 'red'
        ? linearRed
        : request.maskSource === 'green'
          ? linearGreen
          : request.maskSource === 'blue'
            ? linearBlue
            : 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
  }
  return request.invert ? 1 - value : value
}

async function render(request: ImagePreviewRequest) {
  const cached = getCachedPreview(request.cacheKey)
  if (cached) {
    return {
      ...cached,
      pixels: new Uint8ClampedArray(cached.pixels),
      cacheHit: true,
    }
  }
  const sniffed = await sniffImageFile(request.blob)
  if (sniffed.decodedRgbaBytes > MAX_DECODE_BYTES) {
    throw new Error('Decoded image exceeds the preview memory budget')
  }
  const bitmap = await createImageBitmap(request.blob, {
    imageOrientation: 'from-image',
  })
  try {
    if (latestGeneration.get(request.nodeId) !== request.generation) return null
    const scale = Math.min(
      1,
      request.maxLongEdge / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d', {
      alpha: true,
      colorSpace: 'srgb',
      willReadFrequently: true,
    })
    if (!context) throw new Error('Offscreen 2D canvas is unavailable')
    context.drawImage(bitmap, 0, 0, width, height)
    const imageData = context.getImageData(0, 0, width, height)
    const pixels = imageData.data
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (request.mode === 'mask') {
        const value = Math.round(
          Math.min(
            1,
            Math.max(
              0,
              maskValue(
                pixels[offset],
                pixels[offset + 1],
                pixels[offset + 2],
                pixels[offset + 3],
                request,
              ),
            ),
          ) * 255,
        )
        pixels[offset] = value
        pixels[offset + 1] = value
        pixels[offset + 2] = value
        pixels[offset + 3] = 255
      } else if (pixels[offset + 3] <= 0) {
        pixels[offset] = 0
        pixels[offset + 1] = 0
        pixels[offset + 2] = 0
      }
    }
    if (latestGeneration.get(request.nodeId) !== request.generation) return null
    return {
      width,
      height,
      sourceWidth: sniffed.width,
      sourceHeight: sniffed.height,
      pixels,
      sample: Array.from(pixels.subarray(0, 4)) as unknown as [
        number,
        number,
        number,
        number,
      ],
      cacheHit: false,
    }
  } finally {
    bitmap.close()
  }
}

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isImagePreviewRequest(event.data)) return
  const request = event.data
  latestGeneration.set(request.nodeId, request.generation)
  void render(request)
    .then((result) => {
      if (!result) {
        const response: ImagePreviewResponse = {
          protocolVersion: IMAGE_PREVIEW_PROTOCOL_VERSION,
          type: 'preview-canceled',
          requestId: request.requestId,
          nodeId: request.nodeId,
          generation: request.generation,
        }
        workerScope.postMessage(response)
        return
      }
      if (!result.cacheHit) {
        cachePreview(request.cacheKey, {
          width: result.width,
          height: result.height,
          sourceWidth: result.sourceWidth,
          sourceHeight: result.sourceHeight,
          pixels: new Uint8ClampedArray(result.pixels),
          sample: result.sample,
        })
      }
      const response: ImagePreviewResponse = {
        protocolVersion: IMAGE_PREVIEW_PROTOCOL_VERSION,
        type: 'preview-result',
        requestId: request.requestId,
        nodeId: request.nodeId,
        generation: request.generation,
        width: result.width,
        height: result.height,
        sourceWidth: result.sourceWidth,
        sourceHeight: result.sourceHeight,
        pixels: result.pixels.buffer,
        sample: result.sample,
        cacheHit: result.cacheHit,
      }
      workerScope.postMessage(response, [response.pixels])
    })
    .catch((error: unknown) => {
      const response: ImagePreviewResponse = {
        protocolVersion: IMAGE_PREVIEW_PROTOCOL_VERSION,
        type: 'preview-failure',
        requestId: request.requestId,
        nodeId: request.nodeId,
        generation: request.generation,
        diagnostic: error instanceof Error ? error.message : 'Preview failed',
      }
      workerScope.postMessage(response)
    })
})
