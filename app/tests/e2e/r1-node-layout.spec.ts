import { deflateSync } from 'node:zlib'
import { expect, test, type Locator, type Page } from './fixtures'
import { captureNodeLayout, detectNodeLayoutIssues } from './nodeLayoutAudit'

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

function portraitPng() {
  const width = 2
  const height = 4
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const rows = Buffer.from([
    0, 255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 0,
    0, 255, 255, 0, 0, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255,
  ])
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', new Uint8Array()),
  ])
}

async function runWorkflow(page: Page) {
  await page.getByRole('button', { name: 'Run workflow' }).click()
  await expect(
    page.locator('.run-history-row').first().getByText('succeeded'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close run history' }).click()
}

async function resizeBy(
  page: Page,
  node: Locator,
  delta: { x: number; y: number },
) {
  await node.click()
  const handle = node.locator('.react-flow__resize-control.handle.bottom.right')
  const bounds = await handle.boundingBox()
  expect(bounds).not.toBeNull()
  const start = {
    x: bounds!.x + bounds!.width / 2,
    y: bounds!.y + bounds!.height / 2,
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 10 })
  await page.mouse.up()
}

async function auditVariant(
  page: Page,
  node: Locator,
  name: string,
  testInfo: import('@playwright/test').TestInfo,
) {
  const capture = await captureNodeLayout(node)
  expect(detectNodeLayoutIssues(capture), name).toEqual([])
  const canvas = node.getByRole('img')
  if ((await canvas.count()) > 0) {
    const [canvasBounds, previewBounds] = await Promise.all([
      canvas.boundingBox(),
      node.locator('.workflow-node-preview').boundingBox(),
    ])
    expect(canvasBounds).not.toBeNull()
    expect(previewBounds).not.toBeNull()
    expect(canvasBounds!.x).toBeGreaterThanOrEqual(previewBounds!.x - 1)
    expect(canvasBounds!.x + canvasBounds!.width).toBeLessThanOrEqual(
      previewBounds!.x + previewBounds!.width + 1,
    )
    expect(canvasBounds!.y + canvasBounds!.height).toBeLessThanOrEqual(
      previewBounds!.y + previewBounds!.height + 1,
    )
  }
  const screenshotPath = testInfo.outputPath(`r1-layout-${name}.png`)
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach(`r1-layout-${name}`, {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach(`r1-layout-${name}-capture`, {
    body: JSON.stringify(capture, null, 2),
    contentType: 'application/json',
  })
  return capture
}

test('portrait preview content stays contained across node size variants', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await page.getByLabel('Image files').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: portraitPng(),
  })
  await page.getByRole('button', { name: 'Image preview' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const loadNode = page.getByLabel('Load image node')
  const previewNode = page.getByLabel('Image preview node')
  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(previewNode.getByLabel('Image input'))

  await auditVariant(page, previewNode, 'empty-default', testInfo)
  await runWorkflow(page)
  const canvas = previewNode.getByRole('img', {
    name: 'Image preview, 2 by 4 pixels',
  })
  await expect(canvas).toHaveAttribute('data-pixel-sample', '255,0,0,255')
  expect(
    await canvas.evaluate((element) =>
      Array.from(
        (element as HTMLCanvasElement)
          .getContext('2d')!
          .getImageData(0, 0, 1, 1).data,
      ),
    ),
  ).toEqual([255, 0, 0, 255])

  const defaultCapture = await auditVariant(
    page,
    previewNode,
    'result-default',
    testInfo,
  )
  await resizeBy(page, previewNode, { x: 150, y: 220 })
  const tallCapture = await auditVariant(
    page,
    previewNode,
    'result-tall',
    testInfo,
  )
  await resizeBy(page, previewNode, { x: 120, y: -180 })
  const wideCapture = await auditVariant(
    page,
    previewNode,
    'result-wide',
    testInfo,
  )
  await resizeBy(page, previewNode, { x: -320, y: -100 })
  const compactCapture = await auditVariant(
    page,
    previewNode,
    'result-compact',
    testInfo,
  )

  expect(tallCapture.owner.height).toBeGreaterThan(defaultCapture.owner.height)
  expect(wideCapture.owner.width).toBeGreaterThan(tallCapture.owner.width)
  expect(compactCapture.owner.width).toBeLessThan(wideCapture.owner.width)
  await page.getByRole('button', { name: 'Run history' }).click()
  await expect(page.locator('.run-history-row')).toHaveCount(1)
})
