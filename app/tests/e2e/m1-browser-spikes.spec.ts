import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import {
  embedWorkflowInPng,
  extractWorkflowFromPng,
  stripWorkflowFromPng,
} from '../../src/workflow/pngEnvelope'

const sourcePng = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
)

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function addSrgbChunk(png: Uint8Array): Uint8Array {
  const type = new TextEncoder().encode('sRGB')
  const chunk = new Uint8Array(13)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 1)
  chunk.set(type, 4)
  chunk[8] = 0
  view.setUint32(9, crc32(chunk.subarray(4, 9)))
  const output = new Uint8Array(png.length + chunk.length)
  output.set(png.subarray(0, 33), 0)
  output.set(chunk, 33)
  output.set(png.subarray(33), 33 + chunk.length)
  return output
}

test('actual Edge captures browser architecture spike evidence', async ({
  page,
}, testInfo) => {
  const workflowJson = JSON.stringify({
    format: 'textureflow-workflow',
    formatVersion: '1.0.0',
    nodes: [],
    edges: [],
  })
  const embedded = await embedWorkflowInPng(sourcePng, workflowJson)
  const stripped = stripWorkflowFromPng(embedded)
  const taggedSrgb = addSrgbChunk(sourcePng)
  const corrupt = embedded.slice()
  const keyword = new TextEncoder().encode('com.textureflow.workflow')
  const keywordOffset = corrupt.findIndex((_, index) =>
    keyword.every(
      (keywordByte, keywordIndex) =>
        corrupt[index + keywordIndex] === keywordByte,
    ),
  )
  corrupt[keywordOffset + keyword.length + 8] ^= 0xff

  await page.goto('/')
  await expect(page.getByText('WASM compute', { exact: true })).toBeVisible()

  const browserEvidence = await page.evaluate(
    async ({ pngCases }) => {
      async function decodePng(bytes: number[]) {
        const bitmap = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
        )
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('2D canvas is unavailable')
        context.drawImage(bitmap, 0, 0)
        const sample = Array.from(context.getImageData(0, 0, 1, 1).data)
        bitmap.close()
        return { width: canvas.width, height: canvas.height, sample }
      }

      async function canvasPng(
        colorSpace: PredefinedColorSpace,
        fillStyle: string,
      ) {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext('2d', { colorSpace })
        if (!context) return null
        context.fillStyle = fillStyle
        context.fillRect(0, 0, 1, 1)
        const sample = Array.from(
          context.getImageData(0, 0, 1, 1, { colorSpace }).data,
        )
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error('PNG encode failed')),
            'image/png',
          ),
        )
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const chunkTypes: string[] = []
        let offset = 8
        const view = new DataView(bytes.buffer)
        while (offset + 12 <= bytes.length) {
          const length = view.getUint32(offset)
          chunkTypes.push(
            String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)),
          )
          offset += length + 12
        }
        return {
          sample,
          decoded: await decodePng(Array.from(bytes)),
          chunkTypes,
          byteLength: bytes.length,
        }
      }

      interface NavigatorGpuProbe extends Navigator {
        gpu?: {
          requestAdapter(): Promise<{
            requestDevice(): Promise<GpuDeviceProbe>
          } | null>
        }
      }

      interface GpuBufferProbe {
        destroy(): void
        getMappedRange(): ArrayBuffer
        mapAsync(mode: number): Promise<void>
        unmap(): void
      }

      interface GpuDeviceProbe {
        lost: Promise<{ reason: string; message: string }>
        queue: { submit(commands: unknown[]): void }
        createShaderModule(descriptor: { code: string }): unknown
        createComputePipeline(descriptor: {
          layout: 'auto'
          compute: { module: unknown; entryPoint: string }
        }): {
          getBindGroupLayout(index: number): unknown
        }
        createBuffer(descriptor: {
          size: number
          usage: number
          mappedAtCreation?: boolean
        }): GpuBufferProbe
        createBindGroup(descriptor: {
          layout: unknown
          entries: { binding: number; resource: { buffer: GpuBufferProbe } }[]
        }): unknown
        createCommandEncoder(): {
          beginComputePass(): {
            setPipeline(pipeline: unknown): void
            setBindGroup(index: number, bindGroup: unknown): void
            dispatchWorkgroups(count: number): void
            end(): void
          }
          copyBufferToBuffer(
            source: GpuBufferProbe,
            sourceOffset: number,
            destination: GpuBufferProbe,
            destinationOffset: number,
            size: number,
          ): void
          finish(): unknown
        }
        destroy(): void
      }

      async function runWebGpuProbe(device: GpuDeviceProbe | null) {
        if (!device) return null
        const input = new Float32Array([-0.5, 0, 0.25, 0.75, 1])
        const byteLength = input.byteLength
        const storage = device.createBuffer({
          size: byteLength,
          usage: 128 | 4,
          mappedAtCreation: true,
        })
        new Float32Array(storage.getMappedRange()).set(input)
        storage.unmap()
        const readback = device.createBuffer({
          size: byteLength,
          usage: 8 | 1,
        })
        const shader = device.createShaderModule({
          code: `
            @group(0) @binding(0) var<storage, read_write> values: array<f32>;
            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) id: vec3u) {
              if (id.x < arrayLength(&values)) {
                values[id.x] = clamp(values[id.x] + 0.25, 0.0, 1.0);
              }
            }
          `,
        })
        const pipeline = device.createComputePipeline({
          layout: 'auto',
          compute: { module: shader, entryPoint: 'main' },
        })
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: storage } }],
        })
        const encoder = device.createCommandEncoder()
        const pass = encoder.beginComputePass()
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, bindGroup)
        pass.dispatchWorkgroups(1)
        pass.end()
        encoder.copyBufferToBuffer(storage, 0, readback, 0, byteLength)
        device.queue.submit([encoder.finish()])
        await readback.mapAsync(1)
        const output = Array.from(
          new Float32Array(readback.getMappedRange().slice(0)),
        )
        readback.unmap()
        storage.destroy()
        readback.destroy()

        const expected = [0, 0.25, 0.5, 1, 1]
        const maxAbsoluteError = Math.max(
          ...output.map((value, index) => Math.abs(value - expected[index])),
        )
        const lostPromise = device.lost
        device.destroy()
        const lost = await Promise.race([
          lostPromise.then((info) => ({
            reason: info.reason,
            message: info.message,
          })),
          new Promise<{ reason: string; message: string }>((resolve) =>
            window.setTimeout(
              () =>
                resolve({
                  reason: 'timeout',
                  message: 'device.lost did not resolve within 2000 ms',
                }),
              2000,
            ),
          ),
        ])
        return {
          output,
          expected,
          maxAbsoluteError,
          lost,
        }
      }

      const gpu = (navigator as NavigatorGpuProbe).gpu
      const adapter = gpu ? await gpu.requestAdapter() : null
      const device = adapter ? await adapter.requestDevice() : null
      const webGpuProbe = await runWebGpuProbe(device)

      return {
        png: {
          embedded: await decodePng(pngCases.embedded),
          stripped: await decodePng(pngCases.stripped),
          corruptMetadata: await decodePng(pngCases.corrupt),
        },
        color: {
          untagged: await decodePng(pngCases.untagged),
          taggedSrgb: await decodePng(pngCases.taggedSrgb),
          srgb: await canvasPng('srgb', 'rgb(255 128 0)'),
          displayP3: await canvasPng('display-p3', 'color(display-p3 1 0.5 0)'),
        },
        webGpu: {
          navigatorGpu: Boolean(gpu),
          adapter: Boolean(adapter),
          device: Boolean(device),
          probe: webGpuProbe,
        },
      }
    },
    {
      pngCases: {
        embedded: Array.from(embedded),
        stripped: Array.from(stripped),
        corrupt: Array.from(corrupt),
        untagged: Array.from(sourcePng),
        taggedSrgb: Array.from(taggedSrgb),
      },
    },
  )

  const evidencePath = testInfo.outputPath('m1-browser-spike-evidence.json')
  await writeFile(evidencePath, `${JSON.stringify(browserEvidence, null, 2)}\n`)
  await testInfo.attach('m1-browser-spike-evidence', {
    path: evidencePath,
    contentType: 'application/json',
  })

  const decodedPngs = Object.values(browserEvidence.png)
  for (const decoded of decodedPngs) {
    expect(decoded.width).toBe(1)
    expect(decoded.height).toBe(1)
    expect(decoded.sample[3]).toBeGreaterThan(0)
    expect(decoded.sample).toEqual(decodedPngs[0].sample)
  }
  expect(browserEvidence.color.srgb).not.toBeNull()
  expect(browserEvidence.color.untagged.sample).toEqual(
    browserEvidence.color.taggedSrgb.sample,
  )
  expect(browserEvidence.color.displayP3?.chunkTypes).toContain('iCCP')
  expect(browserEvidence.color.displayP3?.decoded.sample[3]).toBe(255)
  expect(browserEvidence.webGpu.probe?.maxAbsoluteError).toBeLessThanOrEqual(
    1e-4,
  )
  await expect(page.getByText('WASM compute', { exact: true })).toBeVisible()

  const corruptEnvelope = await extractWorkflowFromPng(corrupt)
  expect(corruptEnvelope.workflowJson).toBeNull()
  expect(corruptEnvelope.warning).toMatch(/CRC/)

  const screenshotPath = testInfo.outputPath('m1-browser-spikes.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m1-browser-spikes', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})
