import { expect, test } from './fixtures'
import { deflateSync } from 'node:zlib'

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

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = Buffer.from(type, 'ascii')
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

function makeRgbaPng(red: number, green: number, blue: number, alpha: number) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from([0, red, green, blue, alpha]))),
    pngChunk('IEND', new Uint8Array()),
  ])
}

const colorPng = makeRgbaPng(64, 128, 192, 128)

async function runWorkflow(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Run workflow' }).click()
  await expect(
    page.locator('.run-history-row').first().getByText('succeeded'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close run history' }).click()
}

test('user imports an image and previews every mask interpretation', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByLabel('Image files').setInputFiles({
    name: 'color.png',
    mimeType: 'image/png',
    buffer: colorPng,
  })
  await expect(page.getByText('Imported 1 image')).toBeVisible()
  const loadNode = page.getByLabel('Load image node')
  await expect(loadNode).toBeVisible()

  await page.getByRole('button', { name: 'Image preview' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const previewNode = page.getByLabel('Image preview node')
  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(previewNode.getByLabel('Image input'))
  await expect(previewNode.getByRole('img')).toHaveCount(0)
  await runWorkflow(page)

  let canvas = previewNode.getByRole('img', {
    name: 'Image preview, 1 by 1 pixels',
  })
  await expect(canvas).toHaveAttribute('data-pixel-sample', '64,128,191,128')
  expect(
    await canvas.evaluate((element) =>
      Array.from(
        (element as HTMLCanvasElement)
          .getContext('2d')!
          .getImageData(0, 0, 1, 1).data,
      ),
    ),
  ).toEqual([64, 128, 191, 128])

  await loadNode.getByLabel('Load image Output').selectOption('mask')
  const maskSource = loadNode.getByLabel('Load image Mask source')
  const expectedSamples = {
    luminosity: '52,52,52,255',
    alpha: '128,128,128,255',
    red: '13,13,13,255',
    green: '55,55,55,255',
    blue: '133,133,133,255',
  }
  const samples: Record<string, string | null> = {}
  for (const source of Object.keys(expectedSamples)) {
    await maskSource.selectOption(source)
    await runWorkflow(page)
    canvas = previewNode.getByRole('img')
    await expect(canvas).toHaveAttribute(
      'data-pixel-sample',
      expectedSamples[source as keyof typeof expectedSamples],
    )
    samples[source] = await canvas.getAttribute('data-pixel-sample')
  }
  expect(samples).toEqual(expectedSamples)
  const generationBeforeRace = Number(
    await canvas.getAttribute('data-generation'),
  )
  await maskSource.selectOption('red')
  await maskSource.selectOption('blue')
  await expect(canvas).toHaveAttribute('data-pixel-sample', '133,133,133,255')
  expect(Number(await canvas.getAttribute('data-generation'))).toBe(
    generationBeforeRace,
  )
  await runWorkflow(page)
  await maskSource.selectOption('alpha')
  await runWorkflow(page)
  await expect(canvas).toHaveAttribute('data-pixel-sample', '128,128,128,255')
  await expect(canvas).toHaveAttribute('data-cache-hit', 'true')
  await loadNode
    .getByRole('checkbox', { name: 'Invert mask', exact: true })
    .check()
  await expect(canvas).toHaveAttribute('data-pixel-sample', '128,128,128,255')
  await runWorkflow(page)
  await expect(canvas).toHaveAttribute('data-pixel-sample', '127,127,127,255')

  await page.getByRole('button', { name: 'Save project' }).click()
  await page.reload()
  await expect(page.getByLabel('Load image node')).toBeVisible()
  await expect(page.getByLabel('Image preview node')).toBeVisible()
  await expect(
    page.getByLabel('Image preview node').getByRole('img'),
  ).toHaveCount(0)
  await runWorkflow(page)
  await expect(
    page
      .getByLabel('Image preview node')
      .getByRole('img', { name: 'Image preview, 1 by 1 pixels' }),
  ).toHaveAttribute('data-pixel-sample', '127,127,127,255')

  const screenshotPath = testInfo.outputPath('m4-mask-preview.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m4-mask-preview', {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach('m4-mask-samples', {
    body: JSON.stringify(samples, null, 2),
    contentType: 'application/json',
  })
})

test('invalid image batch member is rejected without blocking valid import', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByLabel('Image files').setInputFiles([
    { name: 'color.png', mimeType: 'image/png', buffer: colorPng },
    {
      name: 'not-an-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    },
  ])
  await expect(page.getByText(/Imported 1; rejected 1/)).toBeVisible()
  await expect(page.getByLabel('Load image node')).toHaveCount(1)
})

test('preview rejects decoded allocation beyond the worker memory budget', async ({
  page,
}) => {
  const oversizedHeader = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversizedHeader)
  Buffer.from('IHDR', 'ascii').copy(oversizedHeader, 12)
  oversizedHeader.writeUInt32BE(10_000, 16)
  oversizedHeader.writeUInt32BE(7_000, 20)

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByLabel('Image files').setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: oversizedHeader,
  })
  await expect(page.getByText('Imported 1 image')).toBeVisible()
  const loadNode = page.getByLabel('Load image node')
  await page.getByRole('button', { name: 'Image preview' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(page.getByLabel('Image preview node').getByLabel('Image input'))
  await page.getByRole('button', { name: 'Run workflow' }).click()
  await expect(
    page.locator('.run-history-row').first().getByText('failed'),
  ).toBeVisible()
  await expect(
    page.getByLabel('Image preview node').getByRole('alert').filter({
      hasText: 'Decoded image exceeds the preview memory budget',
    }),
  ).toBeVisible()
})
