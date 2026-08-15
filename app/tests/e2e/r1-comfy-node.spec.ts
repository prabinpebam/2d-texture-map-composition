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

function sourcePng() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 64, 128, 192, 255]))),
    chunk('IEND', new Uint8Array()),
  ])
}

async function addFromLibrary(
  page: import('@playwright/test').Page,
  name: string,
) {
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
}

test('Comfy-style node sockets drive widgets and preserve manual fallback', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()
  await page.getByLabel('Image files').setInputFiles({
    name: 'source.png',
    mimeType: 'image/png',
    buffer: sourcePng(),
  })
  await addFromLibrary(page, 'Integer')
  await addFromLibrary(page, 'Resize')
  await addFromLibrary(page, 'Image preview')
  await page.getByRole('button', { name: 'Fit View' }).click()

  const loadNode = page.getByLabel('Load image node')
  const integerNode = page.getByLabel('Integer node')
  const resizeNode = page.getByLabel('Resize node')
  const previewNode = page.getByLabel('Image preview node')
  await integerNode
    .getByRole('spinbutton', { name: 'Integer Value', exact: true })
    .fill('2')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Width', exact: true })
    .fill('7')
  await resizeNode
    .getByRole('spinbutton', { name: 'Resize Height', exact: true })
    .fill('1')
  await resizeNode.getByLabel('Resize Method').selectOption('nearest.v1')

  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(resizeNode.getByLabel('Input input'))
  await integerNode
    .getByLabel('Integer output', { exact: true })
    .dragTo(resizeNode.getByLabel('Width parameter input'))
  await resizeNode
    .getByLabel('Output output')
    .dragTo(previewNode.getByLabel('Image input'))

  const widthFallback = resizeNode.getByRole('spinbutton', {
    name: 'Resize Width',
    exact: true,
  })
  await expect(widthFallback).toBeDisabled()
  await expect(widthFallback).toHaveValue('7')
  await expect(resizeNode.getByText('Driven', { exact: true })).toBeVisible()
  await expect(
    previewNode.getByRole('img', { name: 'Image preview, 2 by 1 pixels' }),
  ).toHaveAttribute('data-pixel-sample', '64,128,192,255')

  const integerEdge = page.locator(
    '.react-flow__edge-path[style*="port-integer"]',
  )
  await expect(integerEdge).toHaveCount(1)
  const integerStroke = await integerEdge.evaluate(
    (element) => getComputedStyle(element).stroke,
  )
  const integerSocketColor = await integerNode
    .getByLabel('Integer output', { exact: true })
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(integerStroke).toBe(integerSocketColor)

  await resizeNode.click()
  const cornerHandles = page.locator(
    '.react-flow__node[aria-label="Resize node"] .react-flow__resize-control.handle',
  )
  await expect(cornerHandles).toHaveCount(4)
  for (let index = 0; index < 4; index += 1) {
    const bounds = await cornerHandles.nth(index).boundingBox()
    expect(bounds?.width).toBeGreaterThanOrEqual(23.9)
    expect(bounds?.height).toBeGreaterThanOrEqual(23.9)
  }

  const beforeBody = await resizeNode.boundingBox()
  await resizeNode.getByText('Versioned resampling methods').dragTo(previewNode)
  const afterBody = await resizeNode.boundingBox()
  expect(afterBody?.x).toBeCloseTo(beforeBody!.x, 0)
  expect(afterBody?.y).toBeCloseTo(beforeBody!.y, 0)

  const header = resizeNode.locator('.workflow-node-header')
  const headerBox = await header.boundingBox()
  await page.mouse.move(headerBox!.x + 80, headerBox!.y + 15)
  await page.mouse.down()
  await page.mouse.move(headerBox!.x + 140, headerBox!.y + 55, { steps: 12 })
  await page.mouse.up()
  await expect
    .poll(async () => (await resizeNode.boundingBox())?.x)
    .toBeGreaterThan(beforeBody!.x + 40)

  await resizeNode.locator('.workflow-node-header').dblclick()
  const titleInput = resizeNode.getByRole('textbox', { name: 'Node title' })
  await titleInput.fill('Texture size')
  await titleInput.press('Enter')
  const renamedResizeNode = page.getByLabel('Texture size node')
  await expect(renamedResizeNode).toBeVisible()

  await page.getByRole('button', { name: 'Save project' }).click()
  await page.reload()
  const restoredResize = page.getByLabel('Texture size node')
  await expect(
    restoredResize.getByRole('spinbutton', {
      name: 'Texture size Width',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    page.getByLabel('Image preview node').getByRole('img', {
      name: 'Image preview, 2 by 1 pixels',
    }),
  ).toBeVisible()

  const restoredIntegerEdge = page.locator(
    '.react-flow__edge-path[style*="port-integer"]',
  )
  const integerEdgeHitPoint = await restoredIntegerEdge.evaluate((path) => {
    const edge = path.closest('.react-flow__edge')
    const svgPath = path as SVGPathElement
    const matrix = svgPath.getScreenCTM()
    if (!edge || !matrix) return null
    const length = svgPath.getTotalLength()
    for (let step = 2; step <= 8; step += 1) {
      const point = svgPath.getPointAtLength((length * step) / 10)
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix)
      const hit = document.elementFromPoint(screenPoint.x, screenPoint.y)
      if (hit && edge.contains(hit)) {
        return { x: screenPoint.x, y: screenPoint.y }
      }
    }
    return null
  })
  expect(integerEdgeHitPoint).not.toBeNull()
  await page.mouse.click(integerEdgeHitPoint!.x, integerEdgeHitPoint!.y)
  await page.keyboard.press('Delete')
  const restoredFallback = restoredResize.getByRole('spinbutton', {
    name: 'Texture size Width',
    exact: true,
  })
  await expect(restoredFallback).toBeEnabled()
  await expect(restoredFallback).toHaveValue('7')
  await expect(
    page.getByLabel('Image preview node').getByRole('img', {
      name: 'Image preview, 7 by 1 pixels',
    }),
  ).toBeVisible()

  const screenshotPath = testInfo.outputPath('r1-comfy-node-driven-widget.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('r1-comfy-node-driven-widget', {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach('r1-comfy-node-evidence', {
    body: JSON.stringify(
      {
        integerStroke,
        integerSocketColor,
        fallback: 7,
        drivenWidth: 2,
        disconnectedWidth: 7,
        cornerHandleCount: 4,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})
