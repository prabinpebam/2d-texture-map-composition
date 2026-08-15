export const MAX_ENCODED_IMAGE_BYTES = 100 * 1024 * 1024
export const MAX_IMAGE_DIMENSION = 32_768
export const MAX_IMAGE_PIXELS = 268_000_000

export type SupportedImageType = 'image/png' | 'image/jpeg'

export interface SniffedImage {
  mediaType: SupportedImageType
  width: number
  height: number
  pixelCount: number
  decodedRgbaBytes: number
}

function assertDimensions(
  width: number,
  height: number,
): SniffedImage['pixelCount'] {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION
  ) {
    throw new Error('Image dimensions exceed the supported bounds')
  }
  const pixelCount = width * height
  if (pixelCount > MAX_IMAGE_PIXELS) {
    throw new Error('Image pixel count exceeds the supported budget')
  }
  return pixelCount
}

function sniffPng(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (
    bytes.length < 24 ||
    !signature.every((value, index) => bytes[index] === value) ||
    new TextDecoder('ascii').decode(bytes.subarray(12, 16)) !== 'IHDR'
  ) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function sniffJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('Malformed JPEG marker stream')
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) break
    if (marker >= 0xd0 && marker <= 0xd7) continue
    if (offset + 2 > bytes.length) throw new Error('Truncated JPEG segment')
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) {
      throw new Error('Invalid JPEG segment length')
    }
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isStartOfFrame) {
      if (length < 7) throw new Error('Invalid JPEG frame header')
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      }
    }
    offset += length
  }
  throw new Error('JPEG dimensions were not found before scan data')
}

export function sniffImageBytes(
  bytes: Uint8Array,
  encodedByteLength = bytes.byteLength,
): SniffedImage {
  if (encodedByteLength <= 0 || encodedByteLength > MAX_ENCODED_IMAGE_BYTES) {
    throw new Error('Encoded image exceeds the supported file budget')
  }
  const png = sniffPng(bytes)
  const jpeg = png ? null : sniffJpeg(bytes)
  const dimensions = png ?? jpeg
  if (!dimensions) throw new Error('Unsupported image signature')
  const pixelCount = assertDimensions(dimensions.width, dimensions.height)
  return {
    mediaType: png ? 'image/png' : 'image/jpeg',
    width: dimensions.width,
    height: dimensions.height,
    pixelCount,
    decodedRgbaBytes: pixelCount * 4,
  }
}

export async function sniffImageFile(file: Blob): Promise<SniffedImage> {
  const header = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer())
  return sniffImageBytes(header, file.size)
}
