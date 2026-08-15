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

test('user can add delete and restore a graph node', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Load image' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()

  const node = page.getByLabel('Load image node')
  await expect(node).toBeVisible()
  await expect(page.getByText('1 nodes')).toBeVisible()
  await expect(page.getByText('No nodes')).toBeHidden()
  const nodeBounds = await node.boundingBox()
  const graphBounds = await page
    .getByRole('main', { name: 'Graph canvas' })
    .boundingBox()
  expect(nodeBounds).not.toBeNull()
  expect(graphBounds).not.toBeNull()
  expect(nodeBounds!.x).toBeGreaterThanOrEqual(graphBounds!.x)
  expect(nodeBounds!.y).toBeGreaterThanOrEqual(graphBounds!.y)
  expect(
    await node.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit === element || element.contains(hit)
    }),
  ).toBe(true)

  const screenshotPath = testInfo.outputPath('m2-add-node.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m2-add-node', {
    path: screenshotPath,
    contentType: 'image/png',
  })

  await page.getByRole('button', { name: 'Delete selected nodes' }).click()
  await expect(node).toBeHidden()
  await expect(page.getByText('0 nodes')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByLabel('Load image node')).toBeVisible()
  await expect(page.getByText('1 nodes')).toBeVisible()
})

test('keyboard user can move lock and duplicate a node', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Resize' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()

  const node = page.getByLabel('Resize node')
  await node.focus()
  const initialBounds = await node.boundingBox()
  await page.keyboard.press('Alt+Shift+ArrowRight')
  const movedBounds = await node.boundingBox()
  expect(initialBounds).not.toBeNull()
  expect(movedBounds).not.toBeNull()
  expect(movedBounds!.x - initialBounds!.x).toBeCloseTo(10, 0)

  await page.keyboard.press('Control+Shift+M')
  await expect(node.getByText('Muted')).toBeVisible()
  await page.keyboard.press('Control+Shift+L')
  await expect(node.getByText('Locked')).toBeVisible()

  const lockedBounds = await node.boundingBox()
  await page.keyboard.press('Alt+Shift+ArrowRight')
  const afterLockedMove = await node.boundingBox()
  expect(afterLockedMove!.x).toBeCloseTo(lockedBounds!.x, 1)

  await page
    .getByRole('button', { name: 'Toggle lock for selected nodes' })
    .click()
  await page.getByRole('button', { name: 'Duplicate selected nodes' }).click()
  const nodes = page.getByLabel('Resize node')
  await expect(nodes).toHaveCount(2)
  await expect(page.getByText('2 nodes')).toBeVisible()
  const originalBounds = await nodes.nth(0).boundingBox()
  const duplicateBounds = await nodes.nth(1).boundingBox()
  expect(originalBounds).not.toBeNull()
  expect(duplicateBounds).not.toBeNull()
  expect(originalBounds!.x + originalBounds!.width).toBeLessThanOrEqual(
    duplicateBounds!.x,
  )

  const screenshotPath = testInfo.outputPath('m2-node-commands.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m2-node-commands', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('user can connect compatible ports and sees invalid type feedback', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Load image' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  await page.getByRole('button', { name: 'Material' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()

  const sourceNode = page.getByLabel('Load image node')
  const materialNode = page.getByLabel('Material node')
  const imageOutput = sourceNode.getByLabel('Image output')
  await imageOutput.dragTo(materialNode.getByLabel('Lights input'))
  const edges = page.locator('.react-flow__edge')
  await expect(edges).toHaveCount(0)
  await expect(
    page.getByText('Connection rejected: incompatible type'),
  ).toBeVisible()

  await imageOutput.dragTo(materialNode.getByLabel('Base color input'))
  await expect(edges).toHaveCount(1)
  const edgePaint = await edges
    .locator('.react-flow__edge-path')
    .evaluate((element) => {
      const path = element as SVGPathElement
      const style = getComputedStyle(path)
      return {
        data: path.getAttribute('d'),
        length: path.getTotalLength(),
        stroke: style.stroke,
        opacity: Number(style.opacity),
        visibility: style.visibility,
      }
    })
  expect(edgePaint.data).toMatch(/^M/)
  expect(edgePaint.length).toBeGreaterThan(0)
  expect(edgePaint.stroke).not.toBe('none')
  expect(edgePaint.opacity).toBeGreaterThan(0)
  expect(edgePaint.visibility).toBe('visible')
  await expect(edges).toHaveCount(1)
  await expect(
    page.getByText('Connection rejected: incompatible type'),
  ).toBeHidden()

  const screenshotPath = testInfo.outputPath('m2-typed-connections.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m2-typed-connections', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('user can download and import the authored graph workflow', async ({
  context,
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Load image' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('untitled.textureflow.json')
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  await expect(page.getByText('Workflow downloaded')).toBeVisible()

  const importedPage = await context.newPage()
  await importedPage.goto('/')
  await importedPage.getByLabel('Workflow file').setInputFiles(downloadPath!)
  await expect(
    importedPage.getByText('Imported 1 nodes and 0 edges'),
  ).toBeVisible()
  await expect(importedPage.getByLabel('Load image node')).toBeVisible()
  await expect(importedPage.getByText('1 nodes', { exact: true })).toBeVisible()

  const screenshotPath = testInfo.outputPath('m2-workflow-roundtrip.png')
  await importedPage.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m2-workflow-roundtrip', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})
