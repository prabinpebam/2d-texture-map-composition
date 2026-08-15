import { expect, test, type Locator } from '@playwright/test'

async function expectHitTestable(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThan(24)
  expect(box!.height).toBeGreaterThan(24)
  expect(
    await locator.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      )
      return hit === element || element.contains(hit)
    }),
  ).toBe(true)
}

test('first-time user can orient and inspect a node template', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  await expect(page.getByRole('banner')).toBeVisible()
  const library = page.getByRole('complementary', { name: 'Node library' })
  const graph = page.getByRole('main', { name: 'Graph canvas' })
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expectHitTestable(library)
  await expectHitTestable(graph)
  await expectHitTestable(inspector)

  const libraryBox = await library.boundingBox()
  const graphBox = await graph.boundingBox()
  const inspectorBox = await inspector.boundingBox()
  expect(libraryBox!.x + libraryBox!.width).toBeLessThanOrEqual(graphBox!.x + 1)
  expect(graphBox!.x + graphBox!.width).toBeLessThanOrEqual(inspectorBox!.x + 1)

  await page.getByRole('button', { name: 'Load image' }).click()
  await expect(page.getByRole('heading', { name: 'Load image' })).toBeVisible()
  await expect(
    page.getByText('Color image or channel-derived mask'),
  ).toBeVisible()

  const themeButton = page.getByRole('button', {
    name: 'Theme: system. Switch to light',
  })
  await themeButton.click()
  await expect(page.locator('.workspace')).toHaveAttribute(
    'data-theme',
    'light',
  )

  await page.getByRole('banner').focus()
  await page.keyboard.press('F6')
  await expect(library).toBeFocused()

  const screenshotPath = testInfo.outputPath('actual-app-workspace.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('actual-app-workspace', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})
