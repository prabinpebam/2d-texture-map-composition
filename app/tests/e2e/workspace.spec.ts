import { expect, test, type Locator } from '@playwright/test'
import axe from 'axe-core'

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

test('user receives verified compute readiness in the actual workspace', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  const computeStatus = page.getByText('WASM compute', { exact: true })
  await expect(computeStatus).toBeVisible()
  await expect(computeStatus).toHaveAttribute(
    'data-compute-sample',
    '0.25,0.75,1',
  )

  const bounds = await computeStatus.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  )
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerHeight),
  )
  expect(
    await computeStatus.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit === element || element.contains(hit)
    }),
  ).toBe(true)

  const screenshotPath = testInfo.outputPath('m1-wasm-compute-ready.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m1-wasm-compute-ready', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('user receives verified local storage readiness', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  const storageProbe = page.locator(
    '[data-persistence-probe], [data-persistence-error]',
  )
  await expect(storageProbe).toBeVisible()
  const failure = await storageProbe.getAttribute('data-persistence-error')
  expect(failure, failure ?? undefined).toBeNull()
  const storageStatus = page.getByText('Storage verified', { exact: true })
  await expect(storageStatus).toBeVisible()
  const evidence = JSON.parse(
    (await storageStatus.getAttribute('data-persistence-probe')) ?? '{}',
  ) as Record<string, unknown>
  expect(evidence).toMatchObject({
    atomicCommit: true,
    quotaRecovery: true,
    leaseConflictRejected: true,
    broadcastDelivered: true,
  })
  expect(['tab-a', 'tab-b']).toContain(evidence.leaseWinner)

  const bounds = await storageStatus.boundingBox()
  expect(bounds).not.toBeNull()
  expect(
    await storageStatus.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit === element || element.contains(hit)
    }),
  ).toBe(true)

  const screenshotPath = testInfo.outputPath('m1-storage-ready.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m1-storage-ready', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('user can inspect runtime diagnostics and return to the workspace', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  const runtimeButton = page.getByRole('button', { name: 'WASM compute' })
  await expect(runtimeButton).toBeVisible()
  await runtimeButton.click()

  const dialog = page.getByRole('dialog', { name: 'Diagnostics' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('WASM verified')).toBeVisible()
  await expect(dialog.getByText('Sample 0.25 · 0.75 · 1')).toBeVisible()
  await expect(dialog.getByText('Recovery verified')).toBeVisible()
  const closeButton = page.getByRole('button', {
    name: 'Close runtime diagnostics',
  })
  await expect(closeButton).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(closeButton).toBeFocused()

  await page.addScriptTag({ content: axe.source })
  const violations = await page.evaluate(async () => {
    const runtimeAxe = (
      window as typeof window & {
        axe: {
          run(root: Document): Promise<{
            violations: { id: string; impact: string | null }[]
          }>
        }
      }
    ).axe
    return (await runtimeAxe.run(document)).violations
  })
  expect(violations).toEqual([])

  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(
    await closeButton.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit === element || element.contains(hit)
    }),
  ).toBe(true)

  const screenshotPath = testInfo.outputPath('m1-runtime-diagnostics.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m1-runtime-diagnostics', {
    path: screenshotPath,
    contentType: 'image/png',
  })

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(runtimeButton).toBeFocused()
})
