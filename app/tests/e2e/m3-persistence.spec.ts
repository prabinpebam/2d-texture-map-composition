import { expect, test } from '@playwright/test'

test('project repository recovers prior valid snapshot and deduplicates assets', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  const evidence = await page.evaluate(async () => {
    const moduleUrl = '/src/storage/projectRepository.ts'
    const { ProjectRepository, TextureFlowDatabase } = await import(moduleUrl)
    const databaseName = `textureflow-e2e-${crypto.randomUUID()}`
    const repository = new ProjectRepository(
      new TextureFlowDatabase(databaseName),
    )
    try {
      await repository.createProject('project-1', 'Recovery project')
      await repository.saveSnapshot('project-1', '{"revision":1}', 'snapshot-1')
      await repository.saveSnapshot('project-1', '{"revision":2}', 'snapshot-2')
      const beforeCorruption =
        await repository.database.projects.get('project-1')

      await repository.database.snapshots.update('snapshot-2', {
        workflowJson: new Blob(['{"revision":"corrupt"}']),
      })
      const loaded = await repository.loadProject('project-1')

      const firstDigest = await repository.putAsset(
        'project-1',
        new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        'first.png',
        'source',
      )
      const secondDigest = await repository.putAsset(
        'project-1',
        new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        'copy.png',
        'source',
      )

      return {
        currentRevisionBeforeCorruption: beforeCorruption?.revision,
        currentSnapshotBeforeCorruption: beforeCorruption?.currentSnapshotId,
        recoveredRevision: loaded?.snapshot.revision,
        recoveredWorkflow: loaded?.workflowJson,
        recoveredFromPriorSnapshot: loaded?.recoveredFromPriorSnapshot,
        corruptSnapshotIds: loaded?.corruptSnapshotIds,
        corruptSnapshotStillStored: Boolean(
          await repository.database.snapshots.get('snapshot-2'),
        ),
        assetDigestsMatch: firstDigest === secondDigest,
        assetRecordCount: await repository.database.assets.count(),
      }
    } finally {
      repository.close()
      await repository.database.delete()
    }
  })

  expect(evidence).toEqual({
    currentRevisionBeforeCorruption: 2,
    currentSnapshotBeforeCorruption: 'snapshot-2',
    recoveredRevision: 1,
    recoveredWorkflow: '{"revision":1}',
    recoveredFromPriorSnapshot: true,
    corruptSnapshotIds: ['snapshot-2'],
    corruptSnapshotStillStored: true,
    assetDigestsMatch: true,
    assetRecordCount: 1,
  })
  await testInfo.attach('m3-repository-recovery', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  })
})

test('user graph autosaves locally and restores after reload', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByText('Saved locally')).toBeVisible()

  await page.getByRole('button', { name: 'Load image' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  await expect(page.getByLabel('Load image node')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const moduleUrl = '/src/storage/projectRepository.ts'
        const { TextureFlowDatabase } = await import(moduleUrl)
        const database = new TextureFlowDatabase('textureflow')
        try {
          const project = await database.projects.get('untitled-workflow')
          const snapshot = project?.currentSnapshotId
            ? await database.snapshots.get(project.currentSnapshotId)
            : null
          return snapshot
            ? (await snapshot.workflowJson.text()).includes('load-image')
            : false
        } finally {
          database.close()
        }
      }),
    )
    .toBe(true)
  await expect(page.getByText('Saved locally')).toBeVisible({ timeout: 5000 })

  const saved = await page.evaluate(async () => {
    const moduleUrl = '/src/storage/projectRepository.ts'
    const { TextureFlowDatabase } = await import(moduleUrl)
    const database = new TextureFlowDatabase('textureflow')
    try {
      const project = await database.projects.get('untitled-workflow')
      const snapshot = project?.currentSnapshotId
        ? await database.snapshots.get(project.currentSnapshotId)
        : null
      return {
        revision: project?.revision,
        currentSnapshotId: project?.currentSnapshotId,
        snapshotComplete: snapshot?.complete,
        snapshotDigestLength: snapshot?.sha256.length,
      }
    } finally {
      database.close()
    }
  })
  expect(saved.revision).toBeGreaterThanOrEqual(1)
  expect(saved.currentSnapshotId).toBeTruthy()
  expect(saved.snapshotComplete).toBe(true)
  expect(saved.snapshotDigestLength).toBe(64)

  await page.reload()
  const restoredNode = page.getByLabel('Load image node')
  await expect(restoredNode).toBeAttached()
  const paint = await restoredNode.evaluate((element) => {
    const style = getComputedStyle(element)
    const bounds = element.getBoundingClientRect()
    const body = element.querySelector<HTMLElement>('.workflow-node')
    const bodyBounds = body?.getBoundingClientRect()
    return {
      inlineStyle: element.getAttribute('style'),
      visibility: style.visibility,
      display: style.display,
      opacity: style.opacity,
      transform: style.transform,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
      bodyBounds: bodyBounds
        ? {
            x: bodyBounds.x,
            y: bodyBounds.y,
            width: bodyBounds.width,
            height: bodyBounds.height,
          }
        : null,
    }
  })
  expect(paint, JSON.stringify(paint)).toMatchObject({
    visibility: 'visible',
    display: 'block',
    opacity: '1',
  })
  expect(paint.bounds.width, JSON.stringify(paint)).toBeGreaterThan(0)
  expect(paint.bounds.height, JSON.stringify(paint)).toBeGreaterThan(0)
  await expect(restoredNode).toBeVisible()
  await expect(page.getByText('1 nodes', { exact: true })).toBeVisible()
  await expect(page.getByText('Saved locally')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()

  const screenshotPath = testInfo.outputPath('m3-autosave-reload.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m3-autosave-reload', {
    path: screenshotPath,
    contentType: 'image/png',
  })
  await testInfo.attach('m3-autosave-evidence', {
    body: JSON.stringify(saved, null, 2),
    contentType: 'application/json',
  })
})

test('meaningful work requests durability once and explicit save reports quota', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const target = window as typeof window & { persistCalls: number }
    target.persistCalls = 0
    Object.defineProperty(navigator.storage, 'persist', {
      configurable: true,
      value: async () => {
        target.persistCalls += 1
        return true
      },
    })
    Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: async () => ({
        usage: 1024 * 1024,
        quota: 100 * 1024 * 1024,
      }),
    })
  })
  await page.goto('/')
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { persistCalls: number }).persistCalls,
      ),
    )
    .toBe(1)

  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByText('Saved locally')).toBeVisible()
  expect(
    await page.evaluate(
      () => (window as typeof window & { persistCalls: number }).persistCalls,
    ),
  ).toBe(1)

  await page.getByRole('button', { name: 'WASM compute' }).click()
  const diagnostics = page.getByRole('dialog', { name: 'Diagnostics' })
  await expect(diagnostics.getByText(/broadcast · persistent/)).toBeVisible()
  await expect(diagnostics.getByText('1.0 MB of 100.0 MB used')).toBeVisible()

  const screenshotPath = testInfo.outputPath('m3-explicit-save.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m3-explicit-save', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})
