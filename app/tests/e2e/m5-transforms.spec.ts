import { expect, test } from './fixtures'
import { deflateSync } from 'node:zlib'
import {
  applyBrightnessCorrection,
  NEUTRAL_BRIGHTNESS,
} from '../../src/processing/corrections'
import {
  applyColorCorrection,
  NEUTRAL_COLOR_CORRECTION,
} from '../../src/processing/colorCorrection'
import {
  encodedSrgbToLinear,
  linearSrgbToEncoded,
} from '../../src/processing/scalar'

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

function sourcePng() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 64, 128, 192, 128]))),
    chunk('IEND', new Uint8Array()),
  ])
}

function resizeSourcePng() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(3, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk(
      'IDAT',
      deflateSync(
        Buffer.from([0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255]),
      ),
    ),
    chunk('IEND', new Uint8Array()),
  ])
}

test('user composes resize brightness and color corrections in preview', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }),
  ).not.toBeAttached()
  await page.getByLabel('Image files').setInputFiles({
    name: 'source.png',
    mimeType: 'image/png',
    buffer: sourcePng(),
  })
  const loadNode = page.getByLabel('Load image node')

  await page.getByRole('button', { name: 'Resize', exact: true }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const resizeNode = page.getByLabel('Resize node')
  const resizePosition = await resizeNode.boundingBox()
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Width', exact: true })
    .fill('2')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Height', exact: true })
    .fill('2')
  await resizeNode.getByLabel('Resize Method').selectOption('nearest.v1')
  expect(await resizeNode.boundingBox()).toMatchObject({
    x: resizePosition!.x,
    y: resizePosition!.y,
  })

  await page.getByRole('button', { name: 'Brightness' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const brightnessNode = page.getByLabel('Brightness node')

  await page.getByRole('button', { name: 'Color correction' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const colorNode = page.getByLabel('Color correction node')

  await page.getByRole('button', { name: 'Image preview' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const previewNode = page.getByLabel('Image preview node')

  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(resizeNode.getByLabel('Input input'))
  await resizeNode
    .getByLabel('Output output')
    .dragTo(brightnessNode.getByLabel('Image input'))
  await brightnessNode
    .getByLabel('Image output', { exact: true })
    .dragTo(colorNode.getByLabel('Image input'))
  await colorNode
    .getByLabel('Image output', { exact: true })
    .dragTo(previewNode.getByLabel('Image input'))

  const canvas = page.getByRole('img', { name: 'Image preview, 2 by 2 pixels' })
  await expect(canvas).toHaveAttribute('data-pixel-sample', '64,128,191,128')
  await expect(previewNode.getByRole('img')).toHaveCount(1)

  await brightnessNode
    .getByRole('spinbutton', { name: 'Brightness Exposure', exact: true })
    .fill('1')
  await colorNode
    .getByRole('spinbutton', {
      name: 'Color correction Tint mix',
      exact: true,
    })
    .fill('0.5')
  await colorNode.getByLabel('Color correction Tint color').fill('#ff0000')

  const sourcePixel = {
    red: encodedSrgbToLinear(64 / 255),
    green: encodedSrgbToLinear(128 / 255),
    blue: encodedSrgbToLinear(191 / 255),
    alpha: 128 / 255,
  }
  const brightened = applyBrightnessCorrection(sourcePixel, {
    ...NEUTRAL_BRIGHTNESS,
    exposure: 1,
  })
  const corrected = applyColorCorrection(brightened, {
    ...NEUTRAL_COLOR_CORRECTION,
    tint: [1, 0, 0],
    tintMix: 0.5,
  })
  const expectedSample = [
    Math.round(linearSrgbToEncoded(corrected.red) * 255),
    Math.round(linearSrgbToEncoded(corrected.green) * 255),
    Math.round(linearSrgbToEncoded(corrected.blue) * 255),
    128,
  ].join(',')
  await expect(canvas).toHaveAttribute('data-pixel-sample', expectedSample)
  const sample = await canvas.getAttribute('data-pixel-sample')
  expect(sample).toBe(expectedSample)

  await page.getByRole('button', { name: 'Save project' }).click()
  await page.reload()
  await expect(
    page.getByRole('img', { name: 'Image preview, 2 by 2 pixels' }),
  ).toHaveAttribute('data-pixel-sample', sample!)

  const screenshotPath = testInfo.outputPath('m5-transform-chain.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m5-transform-chain', {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach('m5-transform-sample', {
    body: JSON.stringify({ sample, width: 2, height: 2 }, null, 2),
    contentType: 'application/json',
  })
})

test('named resize algorithms produce distinct non-degenerate preview pixels', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await page.getByLabel('Image files').setInputFiles({
    name: 'resize-source.png',
    mimeType: 'image/png',
    buffer: resizeSourcePng(),
  })
  const loadNode = page.getByLabel('Load image node')
  await page.getByRole('button', { name: 'Resize', exact: true }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const resizeNode = page.getByLabel('Resize node')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Width', exact: true })
    .fill('2')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Height', exact: true })
    .fill('1')
  await resizeNode.getByLabel('Resize Method').selectOption('nearest.v1')
  await page.getByRole('button', { name: 'Image preview' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const previewNode = page.getByLabel('Image preview node')
  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(resizeNode.getByLabel('Input input'))
  await resizeNode
    .getByLabel('Output output')
    .dragTo(previewNode.getByLabel('Image input'))

  const canvas = page.getByRole('img', { name: 'Image preview, 2 by 1 pixels' })
  await expect(canvas).toBeVisible()
  const nearestSample = await canvas.getAttribute('data-pixel-sample')
  await resizeNode.getByLabel('Resize Method').selectOption('mitchell.v1')
  await expect
    .poll(() => canvas.getAttribute('data-pixel-sample'))
    .not.toBe(nearestSample)
  const mitchellSample = await canvas.getAttribute('data-pixel-sample')
  expect(nearestSample).not.toBe(mitchellSample)
})
