import { deflateSync } from 'node:zlib'
import { expect, test } from './fixtures'

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array) {
  const typeBytes = Buffer.from(type)
  const output = Buffer.alloc(data.length + 12)
  output.writeUInt32BE(data.length, 0)
  typeBytes.copy(output, 4)
  Buffer.from(data).copy(output, 8)
  output.writeUInt32BE(
    crc32(Buffer.concat([typeBytes, Buffer.from(data)])),
    data.length + 8,
  )
  return output
}

function sourcePng(red: number, green: number, blue: number) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(2, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk(
      'IDAT',
      deflateSync(
        Buffer.from([0, red, green, blue, 255, red, green, blue, 255]),
      ),
    ),
    chunk('IEND', new Uint8Array()),
  ])
}

async function expectSourceSample(
  loadNode: import('@playwright/test').Locator,
  sample: string,
) {
  await expect(
    loadNode.getByRole('img', { name: 'Image preview, 2 by 1 pixels' }),
  ).toHaveAttribute('data-pixel-sample', sample)
}

test('Comfy-style sockets, live dragging, and Load Image ingestion stay visible', async ({
  context,
  page,
}, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await page.getByRole('button', { name: 'Load image' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const loadNode = page.getByLabel('Load image node')
  await expect(loadNode.getByText('Drop an image or browse')).toBeVisible()

  await loadNode.getByLabel('Load image source image').setInputFiles({
    name: 'red.png',
    mimeType: 'image/png',
    buffer: sourcePng(255, 0, 0),
  })
  await expectSourceSample(loadNode, '255,0,0,255')
  await expect(loadNode).toContainText('2 × 1')
  await expect(loadNode.getByRole('button', { name: 'Replace' })).toBeVisible()

  const nodeBody = loadNode.locator('.workflow-node')
  const outputSocket = loadNode.getByLabel('Image output', { exact: true })
  const socketGeometry = await Promise.all([
    nodeBody.boundingBox(),
    outputSocket.boundingBox(),
  ])
  expect(socketGeometry[0]).not.toBeNull()
  expect(socketGeometry[1]).not.toBeNull()
  expect(socketGeometry[1]!.x).toBeLessThan(
    socketGeometry[0]!.x + socketGeometry[0]!.width,
  )
  expect(socketGeometry[1]!.x + socketGeometry[1]!.width).toBeGreaterThan(
    socketGeometry[0]!.x + socketGeometry[0]!.width,
  )
  expect(
    await outputSocket.evaluate((socket) => {
      const box = socket.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit === socket || socket.contains(hit)
    }),
  ).toBe(true)
  await expect(nodeBody).toHaveCSS('overflow', 'visible')

  const workspace = page.locator('.workspace')
  const sourceCanvas = loadNode.getByRole('img', {
    name: 'Image preview, 2 by 1 pixels',
  })
  const initialNodeSize = await loadNode.boundingBox()
  const initialCanvasSize = await sourceCanvas.boundingBox()
  const initialGeneration = await sourceCanvas.getAttribute('data-generation')
  const resizeRevision = Number(
    await workspace.getAttribute('data-authored-revision'),
  )
  const resizeUndoDepth = Number(
    await workspace.getAttribute('data-undo-depth'),
  )
  await loadNode.click()
  const resizeHandle = loadNode.locator(
    '.react-flow__resize-control.handle.bottom.right',
  )
  const resizeHandleBounds = await resizeHandle.boundingBox()
  await page.mouse.move(
    resizeHandleBounds!.x + resizeHandleBounds!.width / 2,
    resizeHandleBounds!.y + resizeHandleBounds!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizeHandleBounds!.x + resizeHandleBounds!.width / 2 + 180,
    resizeHandleBounds!.y + resizeHandleBounds!.height / 2 + 160,
    { steps: 10 },
  )
  const resizingNodeSize = await loadNode.boundingBox()
  const resizingCanvasSize = await sourceCanvas.boundingBox()
  expect(resizingNodeSize!.width).toBeGreaterThan(initialNodeSize!.width + 140)
  expect(resizingNodeSize!.height).toBeGreaterThan(
    initialNodeSize!.height + 120,
  )
  expect(resizingCanvasSize!.width).toBeGreaterThan(
    initialCanvasSize!.width + 140,
  )
  expect(resizingCanvasSize!.height).toBeGreaterThan(
    initialCanvasSize!.height + 100,
  )
  expect(await sourceCanvas.getAttribute('data-generation')).toBe(
    initialGeneration,
  )
  expect(Number(await workspace.getAttribute('data-authored-revision'))).toBe(
    resizeRevision,
  )
  expect(Number(await workspace.getAttribute('data-undo-depth'))).toBe(
    resizeUndoDepth,
  )
  await page.mouse.up()
  await expect
    .poll(async () =>
      Number(await workspace.getAttribute('data-authored-revision')),
    )
    .toBe(resizeRevision + 1)
  await expect
    .poll(async () => Number(await workspace.getAttribute('data-undo-depth')))
    .toBe(resizeUndoDepth + 1)
  await page.getByRole('button', { name: 'Run history' }).click()
  await expect(page.getByText('No workflow runs yet')).toBeVisible()
  await page.getByRole('button', { name: 'Close run history' }).click()

  const initialRevision = Number(
    await workspace.getAttribute('data-authored-revision'),
  )
  const initialUndoDepth = Number(
    await workspace.getAttribute('data-undo-depth'),
  )
  const initialBounds = await loadNode.boundingBox()
  const title = loadNode.locator('.workflow-node-header')
  const titleBounds = await title.boundingBox()
  await page.mouse.move(titleBounds!.x + 80, titleBounds!.y + 15)
  await page.mouse.down()
  await page.mouse.move(titleBounds!.x + 130, titleBounds!.y + 55, { steps: 8 })
  const draggingBounds = await loadNode.boundingBox()
  expect(draggingBounds!.x).toBeGreaterThan(initialBounds!.x + 35)
  expect(draggingBounds!.y).toBeGreaterThan(initialBounds!.y + 25)
  expect(Number(await workspace.getAttribute('data-authored-revision'))).toBe(
    initialRevision,
  )
  expect(Number(await workspace.getAttribute('data-undo-depth'))).toBe(
    initialUndoDepth,
  )
  await page.mouse.up()
  await expect
    .poll(async () =>
      Number(await workspace.getAttribute('data-authored-revision')),
    )
    .toBe(initialRevision + 1)
  await expect
    .poll(async () => Number(await workspace.getAttribute('data-undo-depth')))
    .toBe(initialUndoDepth + 1)

  const greenBytes = sourcePng(0, 255, 0)
  await loadNode.locator('.load-image-source').evaluate(
    (target, bytes) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(
        new File([new Uint8Array(bytes)], 'green.png', { type: 'image/png' }),
      )
      target.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      )
      target.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      )
    },
    [...greenBytes],
  )
  await expectSourceSample(loadNode, '0,255,0,255')

  const blueBytes = sourcePng(0, 0, 255)
  await page.evaluate(
    async (bytes) => {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
        }),
      ])
    },
    [...blueBytes],
  )
  await loadNode.click()
  await page.keyboard.press('Control+V')
  await expectSourceSample(loadNode, '0,0,255,255')

  await loadNode.getByLabel('Load image source image').setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a png'),
  })
  await expect(page.getByText(/broken\.png:/)).toBeVisible()
  await expectSourceSample(loadNode, '0,0,255,255')

  await page.getByRole('button', { name: 'Save project' }).click()
  await page.reload()
  const restoredNode = page.getByLabel('Load image node')
  await expectSourceSample(restoredNode, '0,0,255,255')
  await expect(restoredNode).toContainText('2 × 1')
  const restoredNodeSize = await restoredNode.boundingBox()
  const restoredCanvasSize = await restoredNode.getByRole('img').boundingBox()
  expect(restoredNodeSize!.width).toBeCloseTo(resizingNodeSize!.width, 0)
  expect(restoredNodeSize!.height).toBeCloseTo(resizingNodeSize!.height, 0)
  expect(restoredCanvasSize!.width).toBeGreaterThan(initialCanvasSize!.width)
  expect(restoredCanvasSize!.height).toBeGreaterThan(initialCanvasSize!.height)

  const screenshotPath = testInfo.outputPath('r1-load-image-comfy.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('r1-load-image-comfy', {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach('r1-load-image-evidence', {
    body: JSON.stringify(
      {
        socketGeometry,
        initialBounds,
        draggingBounds,
        initialNodeSize,
        resizingNodeSize,
        initialCanvasSize,
        resizingCanvasSize,
        initialRevision,
        committedRevision: initialRevision + 1,
        samples: {
          browse: '255,0,0,255',
          drop: '0,255,0,255',
          paste: '0,0,255,255',
        },
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})
