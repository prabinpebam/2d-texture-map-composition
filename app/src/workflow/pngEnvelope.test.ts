import { describe, expect, it } from 'vitest'
import {
  embedWorkflowInPng,
  extractWorkflowFromPng,
  stripWorkflowFromPng,
} from './pngEnvelope'

const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
)
const workflow = JSON.stringify({
  format: 'textureflow-workflow',
  formatVersion: '1.0.0',
  nodes: [],
  edges: [],
})

describe('PNG workflow envelope', () => {
  it('round-trips workflow JSON through bounded compressed iTXt', async () => {
    const embedded = await embedWorkflowInPng(png, workflow)
    const result = await extractWorkflowFromPng(embedded)

    expect(result).toEqual({ workflowJson: workflow })
    expect(new TextDecoder().decode(embedded)).toContain(
      'com.textureflow.workflow',
    )
  })

  it('keeps pixel PNG valid when metadata is stripped', async () => {
    const embedded = await embedWorkflowInPng(png, workflow)
    const stripped = stripWorkflowFromPng(embedded)

    expect(await extractWorkflowFromPng(stripped)).toEqual({
      workflowJson: null,
    })
    expect(stripped).toEqual(png)
  })

  it('returns a metadata warning for a corrupt workflow chunk', async () => {
    const embedded = await embedWorkflowInPng(png, workflow)
    const corrupt = embedded.slice()
    const keyword = new TextEncoder().encode('com.textureflow.workflow')
    const keywordOffset = corrupt.findIndex((_, index) =>
      keyword.every(
        (keywordByte, keywordIndex) =>
          corrupt[index + keywordIndex] === keywordByte,
      ),
    )
    corrupt[keywordOffset + keyword.length + 8] ^= 0xff

    const result = await extractWorkflowFromPng(corrupt)
    expect(result.workflowJson).toBeNull()
    expect(result.warning).toMatch(/CRC/)
  })

  it('rejects oversized chunk declarations before allocation', async () => {
    const oversized = png.slice()
    new DataView(oversized.buffer).setUint32(8, 33 * 1024 * 1024)

    const result = await extractWorkflowFromPng(oversized)
    expect(result.workflowJson).toBeNull()
    expect(result.warning).toMatch(/safety limit/)
  })
})
