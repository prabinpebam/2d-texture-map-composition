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
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, red, green, blue, 255]))),
    chunk('IEND', new Uint8Array()),
  ])
}

function largeSourcePng() {
  const width = 256
  const height = 256
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1)
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4
      rows[offset] = (x * 17 + y * 13) % 256
      rows[offset + 1] = (x * 7 + y * 19) % 256
      rows[offset + 2] = (x * 23 + y * 5) % 256
      rows[offset + 3] = 255
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', new Uint8Array()),
  ])
}

async function addPreview(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Image preview' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
}

test('full and partial runs expose exact demanded branches and cache decisions', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()

  await page.getByLabel('Image files').setInputFiles([
    {
      name: 'red.png',
      mimeType: 'image/png',
      buffer: sourcePng(255, 0, 0),
    },
    {
      name: 'green.png',
      mimeType: 'image/png',
      buffer: sourcePng(0, 255, 0),
    },
  ])
  await addPreview(page)
  await addPreview(page)
  await page.getByRole('button', { name: 'Fit View' }).click()

  const loadNodes = page.getByLabel('Load image node')
  const previewNodes = page.getByLabel('Image preview node')
  await loadNodes
    .nth(0)
    .getByLabel('Image output', { exact: true })
    .dragTo(previewNodes.nth(0).getByLabel('Image input'))
  await loadNodes
    .nth(1)
    .getByLabel('Image output', { exact: true })
    .dragTo(previewNodes.nth(1).getByLabel('Image input'))

  await expect(previewNodes.nth(0).getByRole('img')).toHaveAttribute(
    'data-pixel-sample',
    '255,0,0,255',
  )
  await expect(previewNodes.nth(1).getByRole('img')).toHaveAttribute(
    'data-pixel-sample',
    '0,255,0,255',
  )

  await page.getByRole('button', { name: 'Run history' }).click()
  await expect(page.getByText('No workflow runs yet')).toBeVisible()
  await page.getByRole('button', { name: 'Close run history' }).click()

  await page.getByRole('button', { name: 'Run workflow' }).click()
  const fullRun = page.locator('.run-history-row').first()
  await expect(fullRun.getByText('succeeded')).toBeVisible()
  await expect(fullRun).toHaveAttribute('data-target-outputs', /.+,.+/)
  await expect(fullRun).toHaveAttribute('data-demanded-nodes', /.+,.+,.+,.+/)
  const fullDemand = (await fullRun.getAttribute('data-demanded-nodes'))!.split(
    ',',
  )
  expect(new Set(fullDemand).size).toBe(4)

  await page.getByRole('button', { name: 'Close run history' }).click()
  await previewNodes.nth(1).getByRole('button', { name: 'Run branch' }).click()
  const partialRun = page.locator('.run-history-row').first()
  await expect(partialRun.getByText('succeeded')).toBeVisible()
  const partialDemand = (await partialRun.getAttribute(
    'data-demanded-nodes',
  ))!.split(',')
  expect(new Set(partialDemand).size).toBe(2)
  expect(partialDemand.every((nodeId) => fullDemand.includes(nodeId))).toBe(
    true,
  )

  await page.getByRole('button', { name: 'Close run history' }).click()
  await previewNodes.nth(1).getByRole('button', { name: 'Run branch' }).click()
  await expect(
    page.locator('.run-history-row').first().getByText('succeeded'),
  ).toBeVisible()
  await expect(previewNodes.nth(1)).toContainText('cached')

  const screenshotPath = testInfo.outputPath('r1-full-partial-cache.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('r1-full-partial-cache', {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach('r1-run-capture', {
    body: JSON.stringify({ fullDemand, partialDemand }, null, 2),
    contentType: 'application/json',
  })
})

test('interrupt retains a valid preview and stale runs cannot publish current output', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await page.getByLabel('Image files').setInputFiles({
    name: 'large.png',
    mimeType: 'image/png',
    buffer: largeSourcePng(),
  })
  const loadNode = page.getByLabel('Load image node')
  await page.getByRole('button', { name: 'Resize', exact: true }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const resizeNode = page.getByLabel('Resize node')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Width', exact: true })
    .fill('256')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Height', exact: true })
    .fill('256')
  await resizeNode.getByLabel('Resize Method').selectOption('lanczos4.v1')
  await addPreview(page)
  const previewNode = page.getByLabel('Image preview node')
  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(resizeNode.getByLabel('Input input'))
  await resizeNode
    .getByLabel('Output output')
    .dragTo(previewNode.getByLabel('Image input'))
  const priorCanvas = previewNode.getByRole('img', {
    name: 'Image preview, 256 by 256 pixels',
  })
  await expect(priorCanvas).toBeVisible()
  const priorSample = await priorCanvas.getAttribute('data-pixel-sample')

  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Width', exact: true })
    .fill('768')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Height', exact: true })
    .fill('768')
  await page.getByRole('button', { name: 'Run workflow' }).click()
  await expect(
    page.getByRole('button', { name: 'Interrupt runs' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Interrupt runs' }).click()
  const canceledRun = page.locator('.run-history-row').first()
  await expect(canceledRun.getByText('canceled')).toBeVisible()
  await expect(previewNode.getByRole('img')).toHaveAttribute(
    'data-pixel-sample',
    priorSample!,
  )

  await page.getByRole('button', { name: 'Close run history' }).click()
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Width', exact: true })
    .fill('640')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Height', exact: true })
    .fill('640')
  await page.getByRole('button', { name: 'Run workflow' }).click()
  const staleRun = page.locator('.run-history-row').first()
  await expect(staleRun.getByText('running')).toBeVisible()
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Width', exact: true })
    .fill('384')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Height', exact: true })
    .fill('384')
  await expect(staleRun.getByText('succeeded')).toBeVisible({ timeout: 15000 })
  const graphEvidence = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>(
      '.react-flow__viewport',
    )
    const canvas = document.querySelector<HTMLElement>('.react-flow')
    return {
      nodeCount: document.querySelectorAll('.react-flow__node').length,
      viewportTransform: viewport?.style.transform ?? null,
      canvasRect: canvas?.getBoundingClientRect().toJSON() ?? null,
      nodeRects: Array.from(
        document.querySelectorAll<HTMLElement>('.react-flow__node'),
      ).map((node) => ({
        ariaLabel: node.getAttribute('aria-label'),
        rect: node.getBoundingClientRect().toJSON(),
      })),
    }
  })
  await testInfo.attach('r1-stale-graph-capture', {
    body: JSON.stringify(graphEvidence, null, 2),
    contentType: 'application/json',
  })
  expect(graphEvidence.nodeCount).toBe(3)
  await expect(previewNode).toContainText('Stale')
  await expect(previewNode.getByRole('img')).toBeVisible()
  await expect(
    previewNode.getByRole('img', {
      name: 'Image preview, 640 by 640 pixels',
      exact: true,
    }),
  ).toHaveCount(0)

  const screenshotPath = testInfo.outputPath('r1-interrupt-stale.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('r1-interrupt-stale', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})
