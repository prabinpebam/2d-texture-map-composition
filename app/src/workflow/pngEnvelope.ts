const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const WORKFLOW_KEYWORD = 'com.textureflow.workflow'
const MAX_CHUNK_BYTES = 32 * 1024 * 1024
const MAX_ENCODED_ENVELOPE_BYTES = 7 * 1024 * 1024
const MAX_COMPRESSED_PAYLOAD_BYTES = 5 * 1024 * 1024
const MAX_WORKFLOW_JSON_BYTES = 25 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 100

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })

interface PngChunk {
  type: string
  data: Uint8Array
  encoded: Uint8Array
}

interface WorkflowEnvelope {
  envelopeVersion: 1
  compression: 'deflate'
  mediaType: 'application/vnd.textureflow.workflow+json'
  uncompressedBytes: number
  compressedBytes: number
  sha256: string
  payload: string
}

export interface WorkflowEnvelopeResult {
  workflowJson: string | null
  warning?: string
}

const crcTable = Uint32Array.from({ length: 256 }, (_, tableIndex) => {
  let value = tableIndex
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  )
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  )
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function encodeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = textEncoder.encode(type)
  const encoded = new Uint8Array(12 + data.length)
  const view = new DataView(encoded.buffer)
  view.setUint32(0, data.length)
  encoded.set(typeBytes, 4)
  encoded.set(data, 8)
  view.setUint32(8 + data.length, crc32(concatenate([typeBytes, data])))
  return encoded
}

function parsePng(png: Uint8Array): PngChunk[] {
  if (!bytesEqual(png.subarray(0, PNG_SIGNATURE.length), PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature')
  }

  const chunks: PngChunk[] = []
  let offset = PNG_SIGNATURE.length
  let foundEnd = false
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new Error('Truncated PNG chunk')
    const view = new DataView(png.buffer, png.byteOffset + offset)
    const length = view.getUint32(0)
    if (length > MAX_CHUNK_BYTES)
      throw new Error('PNG chunk exceeds safety limit')
    const encodedLength = length + 12
    if (offset + encodedLength > png.length)
      throw new Error('Truncated PNG chunk data')

    const typeBytes = png.subarray(offset + 4, offset + 8)
    const type = textDecoder.decode(typeBytes)
    const data = png.subarray(offset + 8, offset + 8 + length)
    const expectedCrc = view.getUint32(8 + length)
    if (crc32(concatenate([typeBytes, data])) !== expectedCrc) {
      throw new Error(`Invalid CRC for PNG ${type} chunk`)
    }

    chunks.push({
      type,
      data,
      encoded: png.slice(offset, offset + encodedLength),
    })
    offset += encodedLength
    if (type === 'IEND') {
      foundEnd = true
      break
    }
  }

  if (!foundEnd) throw new Error('PNG is missing IEND')
  return chunks
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value))
    throw new Error('Invalid base64url envelope')
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function transform(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const inputBuffer = input.buffer.slice(
    input.byteOffset,
    input.byteOffset + input.byteLength,
  ) as ArrayBuffer
  const inputStream = new Response(inputBuffer).body
  if (!inputStream) throw new Error('Byte transform stream is unavailable')
  const output = await new Response(
    inputStream.pipeThrough(stream),
  ).arrayBuffer()
  return new Uint8Array(output)
}

async function deflate(input: Uint8Array): Promise<Uint8Array> {
  return transform(input, new CompressionStream('deflate'))
}

async function inflate(input: Uint8Array): Promise<Uint8Array> {
  return transform(input, new DecompressionStream('deflate'))
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function isWorkflowChunk(chunk: PngChunk): boolean {
  if (chunk.type !== 'iTXt') return false
  const keywordEnd = chunk.data.indexOf(0)
  if (keywordEnd < 0) return false
  return (
    textDecoder.decode(chunk.data.subarray(0, keywordEnd)) === WORKFLOW_KEYWORD
  )
}

function workflowText(chunk: PngChunk): Uint8Array {
  const keywordEnd = chunk.data.indexOf(0)
  if (
    keywordEnd < 0 ||
    chunk.data[keywordEnd + 1] !== 1 ||
    chunk.data[keywordEnd + 2] !== 0
  ) {
    throw new Error('Unsupported workflow iTXt header')
  }
  const languageEnd = chunk.data.indexOf(0, keywordEnd + 3)
  if (languageEnd < 0) throw new Error('Invalid workflow iTXt language')
  const translatedEnd = chunk.data.indexOf(0, languageEnd + 1)
  if (translatedEnd < 0) throw new Error('Invalid workflow iTXt translation')
  return chunk.data.subarray(translatedEnd + 1)
}

function assertEnvelope(value: unknown): asserts value is WorkflowEnvelope {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid workflow envelope')
  const envelope = value as Record<string, unknown>
  if (
    envelope.envelopeVersion !== 1 ||
    envelope.compression !== 'deflate' ||
    envelope.mediaType !== 'application/vnd.textureflow.workflow+json' ||
    !Number.isSafeInteger(envelope.uncompressedBytes) ||
    !Number.isSafeInteger(envelope.compressedBytes) ||
    typeof envelope.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(envelope.sha256) ||
    typeof envelope.payload !== 'string'
  ) {
    throw new Error('Invalid workflow envelope fields')
  }
}

export async function embedWorkflowInPng(
  png: Uint8Array,
  workflowJson: string,
): Promise<Uint8Array> {
  const chunks = parsePng(png)
  const workflowBytes = textEncoder.encode(workflowJson)
  if (workflowBytes.length > MAX_WORKFLOW_JSON_BYTES) {
    throw new Error('Workflow JSON exceeds envelope limit')
  }
  const compressed = await deflate(workflowBytes)
  if (compressed.length > MAX_COMPRESSED_PAYLOAD_BYTES) {
    throw new Error('Compressed workflow exceeds envelope limit')
  }

  const envelope: WorkflowEnvelope = {
    envelopeVersion: 1,
    compression: 'deflate',
    mediaType: 'application/vnd.textureflow.workflow+json',
    uncompressedBytes: workflowBytes.length,
    compressedBytes: compressed.length,
    sha256: await sha256(workflowBytes),
    payload: bytesToBase64Url(compressed),
  }
  const encodedEnvelope = textEncoder.encode(
    bytesToBase64Url(textEncoder.encode(JSON.stringify(envelope))),
  )
  if (encodedEnvelope.length > MAX_ENCODED_ENVELOPE_BYTES) {
    throw new Error('Encoded workflow envelope exceeds limit')
  }
  const compressedText = await deflate(encodedEnvelope)
  const header = concatenate([
    textEncoder.encode(WORKFLOW_KEYWORD),
    new Uint8Array([0, 1, 0, 0, 0]),
  ])
  const workflowChunk = encodeChunk(
    'iTXt',
    concatenate([header, compressedText]),
  )

  const output: Uint8Array[] = [PNG_SIGNATURE]
  for (const chunk of chunks) {
    if (isWorkflowChunk(chunk)) continue
    if (chunk.type === 'IEND') output.push(workflowChunk)
    output.push(chunk.encoded)
  }
  return concatenate(output)
}

export async function extractWorkflowFromPng(
  png: Uint8Array,
): Promise<WorkflowEnvelopeResult> {
  try {
    const chunks = parsePng(png)
    const chunk = chunks.find(isWorkflowChunk)
    if (!chunk) return { workflowJson: null }

    const encodedEnvelope = await inflate(workflowText(chunk))
    if (encodedEnvelope.length > MAX_ENCODED_ENVELOPE_BYTES) {
      throw new Error('Encoded workflow envelope exceeds limit')
    }
    const envelopeBytes = base64UrlToBytes(textDecoder.decode(encodedEnvelope))
    const envelope = JSON.parse(textDecoder.decode(envelopeBytes)) as unknown
    assertEnvelope(envelope)
    if (
      envelope.compressedBytes > MAX_COMPRESSED_PAYLOAD_BYTES ||
      envelope.uncompressedBytes > MAX_WORKFLOW_JSON_BYTES
    ) {
      throw new Error('Workflow envelope exceeds declared limits')
    }

    const compressed = base64UrlToBytes(envelope.payload)
    if (compressed.length !== envelope.compressedBytes) {
      throw new Error('Compressed workflow length mismatch')
    }
    const workflowBytes = await inflate(compressed)
    if (workflowBytes.length !== envelope.uncompressedBytes) {
      throw new Error('Workflow JSON length mismatch')
    }
    if (
      compressed.length > 0 &&
      workflowBytes.length / compressed.length > MAX_COMPRESSION_RATIO
    ) {
      throw new Error('Workflow envelope compression ratio exceeds limit')
    }
    if ((await sha256(workflowBytes)) !== envelope.sha256) {
      throw new Error('Workflow envelope SHA-256 mismatch')
    }
    return { workflowJson: textDecoder.decode(workflowBytes) }
  } catch (error) {
    return {
      workflowJson: null,
      warning:
        error instanceof Error ? error.message : 'Invalid workflow metadata',
    }
  }
}

export function stripWorkflowFromPng(png: Uint8Array): Uint8Array {
  const chunks = parsePng(png)
  return concatenate([
    PNG_SIGNATURE,
    ...chunks
      .filter((chunk) => !isWorkflowChunk(chunk))
      .map((chunk) => chunk.encoded),
  ])
}
