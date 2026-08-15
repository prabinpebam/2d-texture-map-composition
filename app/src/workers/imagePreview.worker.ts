/// <reference lib="webworker" />

import {
  applyBrightnessCorrection,
  type BrightnessControls,
} from '../processing/corrections'
import {
  applyColorCorrection,
  type ColorCorrectionControls,
} from '../processing/colorCorrection'
import {
  RESIZE_KERNELS,
  resampleScalar1d,
  type ResizeKernelId,
} from '../processing/resampling'
import { encodedSrgbToLinear, linearSrgbToEncoded } from '../processing/scalar'
import { sniffImageFile } from '../processing/imageSniffer'
import {
  IMAGE_PREVIEW_PROTOCOL_VERSION,
  isImagePreviewRequest,
  type ImagePreviewResponse,
  type RenderImagePreviewRequest,
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

function resizeLinearRgba(
  source: Float32Array,
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
  kernel: ResizeKernelId,
) {
  const horizontal = new Float32Array(destinationWidth * sourceHeight * 4)
  for (let row = 0; row < sourceHeight; row += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      const line = new Float32Array(sourceWidth)
      for (let column = 0; column < sourceWidth; column += 1) {
        const offset = (row * sourceWidth + column) * 4
        const alpha = source[offset + 3]
        line[column] = channel === 3 ? alpha : source[offset + channel] * alpha
      }
      const resized = resampleScalar1d(line, destinationWidth, kernel)
      for (let column = 0; column < destinationWidth; column += 1) {
        horizontal[(row * destinationWidth + column) * 4 + channel] =
          resized[column]
      }
    }
  }

  const output = new Float32Array(destinationWidth * destinationHeight * 4)
  for (let column = 0; column < destinationWidth; column += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      const line = new Float32Array(sourceHeight)
      for (let row = 0; row < sourceHeight; row += 1) {
        line[row] = horizontal[(row * destinationWidth + column) * 4 + channel]
      }
      const resized = resampleScalar1d(line, destinationHeight, kernel)
      for (let row = 0; row < destinationHeight; row += 1) {
        output[(row * destinationWidth + column) * 4 + channel] = resized[row]
      }
    }
  }

  for (let offset = 0; offset < output.length; offset += 4) {
    const alpha = output[offset + 3]
    if (alpha <= 1e-7) {
      output[offset] = 0
      output[offset + 1] = 0
      output[offset + 2] = 0
      output[offset + 3] = 0
    } else {
      output[offset] /= alpha
      output[offset + 1] /= alpha
      output[offset + 2] /= alpha
    }
  }
  return output
}

function maskValue(
  red: number,
  green: number,
  blue: number,
  alpha: number,
  request: RenderImagePreviewRequest,
) {
  let value: number
  if (request.maskSource === 'alpha') value = alpha
  else {
    value =
      request.maskSource === 'red'
        ? red
        : request.maskSource === 'green'
          ? green
          : request.maskSource === 'blue'
            ? blue
            : 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  return request.invert ? 1 - value : value
}

async function render(request: RenderImagePreviewRequest) {
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
    const decoded = context.getImageData(0, 0, width, height).data
    let linear = new Float32Array(decoded.length)
    for (let offset = 0; offset < decoded.length; offset += 4) {
      linear[offset] = encodedSrgbToLinear(decoded[offset] / 255)
      linear[offset + 1] = encodedSrgbToLinear(decoded[offset + 1] / 255)
      linear[offset + 2] = encodedSrgbToLinear(decoded[offset + 2] / 255)
      linear[offset + 3] = decoded[offset + 3] / 255
      if (request.mode === 'mask') {
        const value = Math.min(
          1,
          Math.max(
            0,
            maskValue(
              linear[offset],
              linear[offset + 1],
              linear[offset + 2],
              linear[offset + 3],
              request,
            ),
          ),
        )
        linear[offset] = value
        linear[offset + 1] = value
        linear[offset + 2] = value
        linear[offset + 3] = 1
      } else if (linear[offset + 3] <= 0) {
        linear[offset] = 0
        linear[offset + 1] = 0
        linear[offset + 2] = 0
      }
    }
    let currentWidth = width
    let currentHeight = height
    for (const operation of request.operations) {
      if (operation.type === 'resize') {
        if (!RESIZE_KERNELS.includes(operation.kernel as ResizeKernelId)) {
          throw new Error(`Unknown resize kernel: ${operation.kernel}`)
        }
        const operationScale = Math.min(
          1,
          request.maxLongEdge / Math.max(operation.width, operation.height),
        )
        const destinationWidth = Math.max(
          1,
          Math.round(operation.width * operationScale),
        )
        const destinationHeight = Math.max(
          1,
          Math.round(operation.height * operationScale),
        )
        linear = resizeLinearRgba(
          linear,
          currentWidth,
          currentHeight,
          destinationWidth,
          destinationHeight,
          operation.kernel as ResizeKernelId,
        )
        currentWidth = destinationWidth
        currentHeight = destinationHeight
      } else {
        for (let offset = 0; offset < linear.length; offset += 4) {
          const pixel = {
            red: linear[offset],
            green: linear[offset + 1],
            blue: linear[offset + 2],
            alpha: linear[offset + 3],
          }
          const corrected =
            operation.type === 'brightness'
              ? applyBrightnessCorrection(pixel, {
                  exposure: operation.exposure,
                  highlights: operation.highlights,
                  shadows: operation.shadows,
                  whites: operation.whites,
                  blacks: operation.blacks,
                } satisfies BrightnessControls)
              : applyColorCorrection(pixel, {
                  temperature: operation.temperature,
                  greenMagenta: operation.greenMagenta,
                  hueDegrees: operation.hueDegrees,
                  saturation: operation.saturation,
                  tint: operation.tint,
                  tintMix: operation.tintMix,
                } satisfies ColorCorrectionControls)
          linear[offset] = corrected.red
          linear[offset + 1] = corrected.green
          linear[offset + 2] = corrected.blue
          linear[offset + 3] = corrected.alpha
        }
      }
    }
    const pixels = new Uint8ClampedArray(linear.length)
    for (let offset = 0; offset < linear.length; offset += 4) {
      const encode = (value: number) =>
        request.mode === 'mask' ? value : linearSrgbToEncoded(value)
      pixels[offset] = Math.round(
        Math.min(1, Math.max(0, encode(linear[offset]))) * 255,
      )
      pixels[offset + 1] = Math.round(
        Math.min(1, Math.max(0, encode(linear[offset + 1]))) * 255,
      )
      pixels[offset + 2] = Math.round(
        Math.min(1, Math.max(0, encode(linear[offset + 2]))) * 255,
      )
      pixels[offset + 3] = Math.round(
        Math.min(1, Math.max(0, linear[offset + 3])) * 255,
      )
    }
    if (latestGeneration.get(request.nodeId) !== request.generation) return null
    return {
      width: currentWidth,
      height: currentHeight,
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
  if (request.type === 'cancel-preview') return
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
