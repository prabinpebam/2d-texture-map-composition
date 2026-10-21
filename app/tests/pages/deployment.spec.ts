import { expect, test } from '../e2e/fixtures'

test('published build supports image workflows at the repository subpath', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = []
  const failedResponses: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`)
    }
  })

  await page.goto('./')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByText('WASM compute', { exact: true })).toHaveAttribute(
    'data-compute-sample',
    '0.25,0.75,1',
  )
  await expect(
    page.getByText('Storage verified', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()

  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const context = canvas.getContext('2d')!
    context.fillStyle = 'rgb(255, 0, 0)'
    context.fillRect(0, 0, 16, 16)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Image files').setInputFiles({
    name: 'invalid.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  })
  await expect(page.getByText(/Imported 0; rejected 1/)).toBeVisible()
  await page.getByLabel('Image files').setInputFiles({
    name: 'red.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  })
  await expect(page.getByText('Imported 1 image')).toBeVisible()

  await page.getByRole('button', { name: 'Image preview' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  const loadNode = page.getByLabel('Load image node')
  const previewNode = page.getByLabel('Image preview node')
  await loadNode
    .getByLabel('Image output', { exact: true })
    .dragTo(previewNode.getByLabel('Image input'))

  const runButton = page.getByRole('button', { name: 'Run workflow' })
  expect(
    await runButton.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      )
      return hit === element || element.contains(hit)
    }),
  ).toBe(true)
  await runButton.click()
  await expect(
    page.locator('.run-history-row').first().getByText('succeeded'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close run history' }).click()
  const canvas = previewNode.getByRole('img', {
    name: 'Image preview, 16 by 16 pixels',
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

  await page.getByRole('button', { name: 'Save project' }).click()
  await page.reload()
  await expect(loadNode).toBeVisible()
  await expect(previewNode).toBeVisible()
  await runButton.click()
  await expect(
    page.locator('.run-history-row').first().getByText('succeeded'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close run history' }).click()
  await expect(canvas).toHaveAttribute('data-pixel-sample', '255,0,0,255')
  await expect(page.getByText('WASM compute', { exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(failedResponses).toEqual([])

  await page.screenshot({
    path: testInfo.outputPath('pages-image-workflow.png'),
    fullPage: true,
  })
})
