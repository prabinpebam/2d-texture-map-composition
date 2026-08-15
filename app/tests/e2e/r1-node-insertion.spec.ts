import { expect, test, type Locator, type Page } from './fixtures'

async function center(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  }
}

function expectNear(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(2)
}

async function openSlashSearch(page: Page) {
  await page.getByRole('main', { name: 'Graph canvas' }).focus()
  await page.keyboard.press('/')
  const dialog = page.getByRole('dialog', { name: 'Add node' })
  await expect(dialog).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Search node types' }),
  ).toBeFocused()
  return dialog
}

test('node templates insert by drop, slash search, and canvas double-click', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close inspector' }).click()
  const graph = page.getByRole('main', { name: 'Graph canvas' })
  const graphBox = await graph.boundingBox()
  expect(graphBox).not.toBeNull()

  await openSlashSearch(page)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Add node' }),
  ).not.toBeAttached()
  await expect(page.locator('.react-flow__node')).toHaveCount(0)

  await page.getByRole('button', { name: 'Zoom In' }).click()
  await page.getByRole('button', { name: 'Zoom In' }).click()
  await expect(page.getByText('144%', { exact: true })).toBeVisible()

  const dropPoint = {
    x: graphBox!.x + 245,
    y: graphBox!.y + 220,
  }
  await page
    .getByRole('button', { name: 'Resize', exact: true })
    .dragTo(graph, {
      targetPosition: {
        x: dropPoint.x - graphBox!.x,
        y: dropPoint.y - graphBox!.y,
      },
    })
  const resizeNode = page.getByLabel('Resize node')
  await expect(resizeNode).toBeVisible()
  expectNear(await center(resizeNode), dropPoint)

  const graphCenter = {
    x: graphBox!.x + graphBox!.width / 2,
    y: graphBox!.y + graphBox!.height / 2,
  }
  const dialog = await openSlashSearch(page)
  const dialogCenter = await center(dialog)
  expectNear(dialogCenter, {
    x: page.viewportSize()!.width / 2,
    y: page.viewportSize()!.height / 2,
  })
  await page.getByRole('combobox', { name: 'Search node types' }).fill('image')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('option', { name: /Image preview/ }),
  ).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  const previewNode = page.getByLabel('Image preview node')
  await expect(previewNode).toBeVisible()
  expectNear(await center(previewNode), graphCenter)

  const doubleClickPoint = {
    x: graphBox!.x + graphBox!.width - 220,
    y: graphBox!.y + 210,
  }
  await page.mouse.dblclick(doubleClickPoint.x, doubleClickPoint.y)
  await expect(page.getByRole('dialog', { name: 'Add node' })).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Search node types' })
    .fill('brightness')
  await page.getByRole('option', { name: /Brightness/ }).click()
  const brightnessNode = page.getByLabel('Brightness node')
  await expect(brightnessNode).toBeVisible()
  expectNear(await center(brightnessNode), doubleClickPoint)
  await expect(graph).toBeFocused()

  const screenshotPath = testInfo.outputPath('r1-node-insertion-paths.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('r1-node-insertion-paths', {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach('r1-node-insertion-geometry', {
    body: JSON.stringify(
      {
        zoom: 1.44,
        dropPoint,
        dropCenter: await center(resizeNode),
        graphCenter,
        slashCenter: await center(previewNode),
        doubleClickPoint,
        doubleClickCenter: await center(brightnessNode),
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})
