import { describe, expect, it } from 'vitest'
import { MAX_ENCODED_IMAGE_BYTES, sniffImageBytes } from './imageSniffer'

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  bytes.set(new TextEncoder().encode('IHDR'), 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function jpegHeader(width: number, height: number) {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
  ])
}

describe('bounded image signature sniffing', () => {
  it('reads PNG and JPEG dimensions from signatures', () => {
    expect(sniffImageBytes(pngHeader(640, 480))).toMatchObject({
      mediaType: 'image/png',
      width: 640,
      height: 480,
      pixelCount: 307_200,
      decodedRgbaBytes: 1_228_800,
    })
    expect(sniffImageBytes(jpegHeader(320, 200))).toMatchObject({
      mediaType: 'image/jpeg',
      width: 320,
      height: 200,
    })
  })

  it('rejects signature, file-size, dimension, pixel, and segment failures', () => {
    expect(() => sniffImageBytes(new Uint8Array([1, 2, 3]))).toThrow(
      'Unsupported image signature',
    )
    expect(() =>
      sniffImageBytes(pngHeader(1, 1), MAX_ENCODED_IMAGE_BYTES + 1),
    ).toThrow('file budget')
    expect(() => sniffImageBytes(pngHeader(40_000, 1))).toThrow('dimensions')
    expect(() => sniffImageBytes(pngHeader(20_000, 20_000))).toThrow(
      'pixel count',
    )
    expect(() =>
      sniffImageBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff])),
    ).toThrow('segment length')
  })
})
