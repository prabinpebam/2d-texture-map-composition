import { expect, test, type Page } from '@playwright/test'

async function expectSnapshotContains(
  page: Page,
  projectId: string,
  nodeType: string,
) {
  await expect
    .poll(() =>
      page.evaluate(
        async ({ targetProjectId, targetNodeType }) => {
          const moduleUrl = '/src/storage/projectRepository.ts'
          const { TextureFlowDatabase } = await import(moduleUrl)
          const database = new TextureFlowDatabase('textureflow')
          try {
            const project = await database.projects.get(targetProjectId)
            const snapshot = project?.currentSnapshotId
              ? await database.snapshots.get(project.currentSnapshotId)
              : null
            return snapshot
              ? (await snapshot.workflowJson.text()).includes(targetNodeType)
              : false
          } finally {
            database.close()
          }
        },
        { targetProjectId: projectId, targetNodeType: nodeType },
      ),
    )
    .toBe(true)
}

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
      await repository.renameProject('project-1', 'Renamed recovery project')
      const renamedProject = await repository.database.projects.get('project-1')
      await repository.createProject('delete-me', 'Delete me')
      await repository.saveSnapshot(
        'delete-me',
        '{"revision":0}',
        'delete-snapshot',
      )
      await repository.deleteProject('delete-me')

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
        renamedProject: renamedProject?.name,
        deletedProjectExists: Boolean(
          await repository.database.projects.get('delete-me'),
        ),
        deletedSnapshotExists: Boolean(
          await repository.database.snapshots.get('delete-snapshot'),
        ),
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
    renamedProject: 'Renamed recovery project',
    deletedProjectExists: false,
    deletedSnapshotExists: false,
  })
  await testInfo.attach('m3-repository-recovery', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  })
})

test('repository verifies checkpoints reclaims previews and arbitrates expiring leases', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const evidence = await page.evaluate(async () => {
    const moduleUrl = '/src/storage/projectRepository.ts'
    const { ProjectRepository, TextureFlowDatabase } = await import(moduleUrl)
    const databaseName = `textureflow-recovery-${crypto.randomUUID()}`
    const repository = new ProjectRepository(
      new TextureFlowDatabase(databaseName),
    )
    try {
      await repository.createProject('project-1', 'Recovery controls')
      await repository.saveCheckpoint('project-1', '{"draft":1}', 1)
      const validCheckpoint = await repository.loadCheckpoint('project-1')
      await repository.database.checkpoints.update('project-1', {
        workflowJson: new Blob(['{"draft":"corrupt"}']),
      })
      const corruptCheckpoint = await repository.loadCheckpoint('project-1')

      await repository.putPreview({
        hash: 'preview-a',
        projectId: 'project-1',
        blob: new Blob([new Uint8Array(32)]),
        byteLength: 32,
        lastAccessedAt: 1,
      })
      await repository.putPreview({
        hash: 'preview-b',
        projectId: 'project-1',
        blob: new Blob([new Uint8Array(64)]),
        byteLength: 64,
        lastAccessedAt: 2,
      })
      const reclaimedBytes = await repository.reclaimPreviews('project-1')

      const firstClaim = await repository.claimLease(
        'project-1',
        'tab-a',
        1000,
        6000,
      )
      const conflictingClaim = await repository.claimLease(
        'project-1',
        'tab-b',
        2000,
        6000,
      )
      const expiredClaim = await repository.claimLease(
        'project-1',
        'tab-b',
        8000,
        6000,
      )
      const oldTokenRenewed = firstClaim.acquired
        ? await repository.renewLease(
            'project-1',
            firstClaim.lease.token,
            1,
            8100,
          )
        : null
      let oldTokenSaveRejected = false
      if (firstClaim.acquired) {
        try {
          await repository.saveSnapshot(
            'project-1',
            '{"stale":true}',
            'stale-snapshot',
            firstClaim.lease.token,
          )
        } catch {
          oldTokenSaveRejected = true
        }
      }
      const newTokenReleased = expiredClaim.acquired
        ? await repository.releaseLease('project-1', expiredClaim.lease.token)
        : null

      return {
        validCheckpointRevision: validCheckpoint?.revision,
        corruptCheckpointRejected: corruptCheckpoint === null,
        corruptCheckpointRetained: Boolean(
          await repository.database.checkpoints.get('project-1'),
        ),
        reclaimedBytes,
        remainingPreviews: await repository.database.previews.count(),
        firstClaimed: firstClaim.acquired,
        conflictRejected: !conflictingClaim.acquired,
        expiredClaimedByTabB:
          expiredClaim.acquired && expiredClaim.lease.tabId === 'tab-b',
        oldTokenRenewed,
        oldTokenSaveRejected,
        newTokenReleased,
      }
    } finally {
      repository.close()
      await repository.database.delete()
    }
  })

  expect(evidence).toEqual({
    validCheckpointRevision: 1,
    corruptCheckpointRejected: true,
    corruptCheckpointRetained: true,
    reclaimedBytes: 96,
    remainingPreviews: 0,
    firstClaimed: true,
    conflictRejected: true,
    expiredClaimedByTabB: true,
    oldTokenRenewed: false,
    oldTokenSaveRejected: true,
    newTokenReleased: true,
  })
  await testInfo.attach('m3-recovery-lease-evidence', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  })
})

test('pagehide checkpoint restores newer draft and quota retry reclaims previews', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.getByRole('button', { name: 'Load image' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  )
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const moduleUrl = '/src/storage/projectRepository.ts'
        const { TextureFlowDatabase } = await import(moduleUrl)
        const database = new TextureFlowDatabase('textureflow')
        try {
          const checkpoint = await database.checkpoints.get('untitled-workflow')
          return checkpoint
            ? (await checkpoint.workflowJson.text()).includes('load-image')
            : false
        } finally {
          database.close()
        }
      }),
    )
    .toBe(true)

  const quotaEvidence = await page.evaluate(async () => {
    const moduleUrl = '/src/storage/projectRepository.ts'
    const { ProjectRepository, TextureFlowDatabase } = await import(moduleUrl)
    const quotaDatabaseName = `textureflow-quota-${crypto.randomUUID()}`
    const quotaRepository = new ProjectRepository(
      new TextureFlowDatabase(quotaDatabaseName),
    )
    try {
      await quotaRepository.createProject('quota-project', 'Quota project')
      await quotaRepository.putPreview({
        hash: 'reclaimable',
        projectId: 'quota-project',
        blob: new Blob([new Uint8Array(128)]),
        byteLength: 128,
        lastAccessedAt: 1,
      })
      const originalSave = quotaRepository.saveSnapshot.bind(quotaRepository)
      let attempts = 0
      quotaRepository.saveSnapshot = async (...arguments_) => {
        attempts += 1
        if (attempts === 1) {
          throw new DOMException('Injected quota', 'QuotaExceededError')
        }
        return originalSave(...arguments_)
      }
      const result = await quotaRepository.saveSnapshotWithQuotaRecovery(
        'quota-project',
        '{"quota":true}',
        'quota-snapshot',
      )

      const mainRepository = new ProjectRepository(
        new TextureFlowDatabase('textureflow'),
      )
      try {
        const project =
          await mainRepository.database.projects.get('untitled-workflow')
        const current = project?.currentSnapshotId
          ? await mainRepository.database.snapshots.get(
              project.currentSnapshotId,
            )
          : null
        const checkpoint =
          await mainRepository.loadCheckpoint('untitled-workflow')
        const baseWorkflow = checkpoint?.workflowJson ?? current?.workflowJson
        if (!project || !baseWorkflow) {
          throw new Error('Project has no verified recovery state')
        }
        const workflow = JSON.parse(await baseWorkflow.text()) as {
          nodes: unknown[]
        }
        workflow.nodes.push({
          id: 'checkpoint-light',
          type: 'light',
          label: 'Light',
          position: { x: 380, y: 100 },
          size: { width: 240, height: 128 },
          zIndex: 1,
          bypassed: false,
          muted: false,
          locked: false,
        })
        await mainRepository.saveCheckpoint(
          'untitled-workflow',
          JSON.stringify(workflow),
          Math.max(project.revision, checkpoint?.revision ?? 0) + 1,
        )
      } finally {
        mainRepository.close()
      }

      return {
        attempts,
        reclaimedBytes: result.reclaimedBytes,
        previewCount: await quotaRepository.database.previews.count(),
        savedRevision: result.snapshot.revision,
      }
    } finally {
      quotaRepository.close()
      await quotaRepository.database.delete()
    }
  })
  expect(quotaEvidence).toEqual({
    attempts: 2,
    reclaimedBytes: 128,
    previewCount: 0,
    savedRevision: 1,
  })

  await page.reload()
  await expect(page.getByText('Recovered prior snapshot')).toBeVisible()
  await expect(page.getByLabel('Load image node')).toBeVisible()
  await expect(page.getByLabel('Light node')).toBeVisible()
  await testInfo.attach('m3-checkpoint-quota-evidence', {
    body: JSON.stringify(quotaEvidence, null, 2),
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

test('user creates renames deletes and reopens isolated local projects', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.getByRole('button', { name: 'Load image' }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  await page.getByRole('button', { name: 'Save project' }).click()
  await expectSnapshotContains(page, 'untitled-workflow', 'load-image')
  await expect(page.getByText('Saved locally')).toBeVisible()

  await page.getByRole('button', { name: 'Untitled workflow' }).click()
  const browser = page.getByRole('dialog', { name: 'Project browser' })
  await expect(browser).toBeVisible()
  await browser.getByLabel('New project name').fill('Second project')
  await browser.getByRole('button', { name: 'Create' }).click()
  await browser.getByRole('button', { name: 'Open Second project' }).click()

  await expect(
    page.getByRole('button', { name: 'Second project' }),
  ).toBeVisible()
  await expect(page.getByText('0 nodes', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: 'Add to canvas' }).click()
  await page.getByRole('button', { name: 'Save project' }).click()
  const secondProjectId = await page.evaluate(async () => {
    const moduleUrl = '/src/storage/projectRepository.ts'
    const { TextureFlowDatabase } = await import(moduleUrl)
    const database = new TextureFlowDatabase('textureflow')
    try {
      return (
        await database.projects.where('name').equals('Second project').first()
      )?.id
    } finally {
      database.close()
    }
  })
  expect(secondProjectId).toBeTruthy()
  await expectSnapshotContains(page, secondProjectId!, 'light')
  await expect(page.getByText('Saved locally')).toBeVisible()

  await page.getByRole('button', { name: 'Second project' }).click()
  const secondName = browser.getByLabel('Name for Second project', {
    exact: true,
  })
  await secondName.fill('Renamed project')
  await browser
    .getByRole('button', { name: 'Save name for Second project' })
    .click()
  await expect(
    page.getByRole('button', { name: 'Renamed project', exact: true }),
  ).toBeVisible()

  await browser.getByLabel('New project name').fill('Delete me')
  await browser.getByRole('button', { name: 'Create' }).click()
  await browser.getByRole('button', { name: 'Delete Delete me' }).click()
  await expect(
    browser.getByLabel('Name for Delete me', { exact: true }),
  ).toBeHidden()

  await browser.getByRole('button', { name: 'Open Untitled workflow' }).click()
  await expect(
    page.getByRole('button', { name: 'Untitled workflow', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Load image node')).toBeVisible()
  await expect(page.getByLabel('Light node')).toBeHidden()

  const screenshotPath = testInfo.outputPath('m3-project-browser.png')
  await page.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m3-project-browser', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})

test('second tab opens read-only and takes over after owner closes', async ({
  context,
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Save project' })).toBeEnabled()

  const secondPage = await context.newPage()
  await secondPage.goto('/')
  await expect(secondPage.getByText('Read-only in another tab')).toBeVisible()
  await secondPage.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(
    secondPage.getByRole('button', { name: 'Add to canvas' }),
  ).toBeDisabled()
  await expect(
    secondPage.getByRole('button', { name: 'Save project' }),
  ).toBeDisabled()
  const takeOver = secondPage.getByRole('button', {
    name: 'Read-only · Take over',
  })
  await expect(takeOver).toBeVisible()

  await page.close()
  await takeOver.click()
  await expect(
    secondPage.getByRole('button', { name: 'Add to canvas' }),
  ).toBeEnabled({ timeout: 10000 })
  await expect(takeOver).toBeHidden()

  await secondPage.getByRole('button', { name: 'Light', exact: true }).click()
  await secondPage.getByRole('button', { name: 'Add to canvas' }).click()
  await secondPage.getByRole('button', { name: 'Save project' }).click()
  await expectSnapshotContains(secondPage, 'untitled-workflow', 'light')

  const screenshotPath = testInfo.outputPath('m3-read-only-takeover.png')
  await secondPage.screenshot({ fullPage: true, path: screenshotPath })
  await testInfo.attach('m3-read-only-takeover', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})
