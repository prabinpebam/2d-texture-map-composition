import Dexie, { type Table } from 'dexie'

export interface ProjectRecord {
  id: string
  name: string
  currentSnapshotId: string | null
  revision: number
  createdAt: number
  modifiedAt: number
  schemaVersion: 1
  appVersion: string
  persistent: boolean
}

export interface SnapshotRecord {
  id: string
  projectId: string
  parentId: string | null
  revision: number
  workflowJson: Blob
  sha256: string
  createdAt: number
  complete: boolean
}

export interface AssetRecord {
  digest: string
  blob: Blob
  mediaType: string
  byteLength: number
  createdAt: number
}

export interface ProjectAssetRecord {
  projectId: string
  digest: string
  displayName: string
  roleHint: string
  importedAt: number
}

export interface CheckpointRecord {
  projectId: string
  revision: number
  workflowJson: Blob
  sha256: string
  createdAt: number
}

export interface LeaseRecord {
  projectId: string
  tabId: string
  token: string
  expiresAt: number
  lastRevision: number
}

export interface PreviewRecord {
  hash: string
  projectId: string
  blob: Blob
  byteLength: number
  lastAccessedAt: number
}

export interface SettingRecord {
  key: string
  schemaVersion: number
  value: unknown
}

export type LeaseClaimResult =
  | { acquired: true; lease: LeaseRecord }
  | { acquired: false; lease: LeaseRecord }

export interface LoadedProject {
  project: ProjectRecord
  workflowJson: string
  snapshot: SnapshotRecord
  recoveredFromPriorSnapshot: boolean
  corruptSnapshotIds: readonly string[]
}

export class TextureFlowDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>
  snapshots!: Table<SnapshotRecord, string>
  assets!: Table<AssetRecord, string>
  projectAssets!: Table<ProjectAssetRecord, [string, string]>
  checkpoints!: Table<CheckpointRecord, string>
  leases!: Table<LeaseRecord, string>
  previews!: Table<PreviewRecord, string>
  settings!: Table<SettingRecord, string>

  constructor(name = 'textureflow') {
    super(name)
    this.version(1).stores({
      projects: 'id, modifiedAt, name',
      snapshots: 'id, [projectId+revision], projectId, revision',
      assets: 'digest, createdAt',
      projectAssets: '[projectId+digest], projectId, digest',
      checkpoints: 'projectId, revision',
      leases: 'projectId, expiresAt',
    })
    this.version(2).stores({
      projects: 'id, modifiedAt, name',
      snapshots: 'id, [projectId+revision], projectId, revision',
      assets: 'digest, createdAt',
      projectAssets: '[projectId+digest], projectId, digest',
      checkpoints: 'projectId, revision',
      leases: 'projectId, expiresAt',
      previews: 'hash, projectId, lastAccessedAt',
      settings: 'key',
    })
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return bytesToHex(new Uint8Array(digest))
}

export class ProjectRepository {
  readonly database: TextureFlowDatabase

  constructor(database = new TextureFlowDatabase()) {
    this.database = database
  }

  async createProject(id: string, name: string): Promise<ProjectRecord> {
    const now = Date.now()
    const project: ProjectRecord = {
      id,
      name,
      currentSnapshotId: null,
      revision: 0,
      createdAt: now,
      modifiedAt: now,
      schemaVersion: 1,
      appVersion: '0.1.0',
      persistent: false,
    }
    await this.database.projects.add(project)
    return project
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return this.database.projects.orderBy('modifiedAt').reverse().toArray()
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    const normalizedName = name.trim()
    if (!normalizedName || normalizedName.length > 200) {
      throw new Error('Project name must be 1-200 characters')
    }
    const updated = await this.database.projects.update(projectId, {
      name: normalizedName,
      modifiedAt: Date.now(),
    })
    if (updated === 0) throw new Error(`Unknown project: ${projectId}`)
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.database.transaction(
      'rw',
      [
        this.database.projects,
        this.database.snapshots,
        this.database.projectAssets,
        this.database.checkpoints,
        this.database.leases,
      ],
      async () => {
        await this.database.snapshots
          .where('projectId')
          .equals(projectId)
          .delete()
        await this.database.projectAssets
          .where('projectId')
          .equals(projectId)
          .delete()
        await this.database.checkpoints.delete(projectId)
        await this.database.leases.delete(projectId)
        await this.database.projects.delete(projectId)
      },
    )
  }

  async saveSnapshot(
    projectId: string,
    workflowJson: string,
    snapshotId: string = crypto.randomUUID(),
    leaseToken?: string,
  ): Promise<SnapshotRecord> {
    const workflowBlob = new Blob([workflowJson], {
      type: 'application/vnd.textureflow.workflow+json',
    })
    const sha256 = await sha256Blob(workflowBlob)
    const project = await this.database.projects.get(projectId)
    if (!project) throw new Error(`Unknown project: ${projectId}`)
    const snapshot: SnapshotRecord = {
      id: snapshotId,
      projectId,
      parentId: project.currentSnapshotId,
      revision: project.revision + 1,
      workflowJson: workflowBlob,
      sha256,
      createdAt: Date.now(),
      complete: true,
    }

    await this.database.transaction(
      'rw',
      [
        this.database.projects,
        this.database.snapshots,
        this.database.checkpoints,
        this.database.leases,
      ],
      async () => {
        const current = await this.database.projects.get(projectId)
        if (!current || current.revision !== project.revision) {
          throw new Error(
            'Project revision changed during snapshot preparation',
          )
        }
        if (leaseToken) {
          const lease = await this.database.leases.get(projectId)
          if (
            !lease ||
            lease.token !== leaseToken ||
            lease.expiresAt <= Date.now()
          ) {
            throw new Error('Project write lease is no longer valid')
          }
        }
        await this.database.snapshots.add(snapshot)
        await this.database.projects.update(projectId, {
          currentSnapshotId: snapshot.id,
          revision: snapshot.revision,
          modifiedAt: snapshot.createdAt,
        })
        await this.database.checkpoints.delete(projectId)
      },
    )
    return snapshot
  }

  async saveSnapshotWithQuotaRecovery(
    projectId: string,
    workflowJson: string,
    snapshotId?: string,
    leaseToken?: string,
  ): Promise<{ snapshot: SnapshotRecord; reclaimedBytes: number }> {
    try {
      return {
        snapshot: await this.saveSnapshot(
          projectId,
          workflowJson,
          snapshotId,
          leaseToken,
        ),
        reclaimedBytes: 0,
      }
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'QuotaExceededError'
      )) {
        throw error
      }
      const reclaimedBytes = await this.reclaimPreviews()
      if (reclaimedBytes === 0) throw error
      return {
        snapshot: await this.saveSnapshot(
          projectId,
          workflowJson,
          snapshotId,
          leaseToken,
        ),
        reclaimedBytes,
      }
    }
  }

  async saveCheckpoint(
    projectId: string,
    workflowJson: string,
    revision: number,
  ): Promise<CheckpointRecord> {
    const workflowJsonBlob = new Blob([workflowJson], {
      type: 'application/vnd.textureflow.workflow+json',
    })
    const checkpoint: CheckpointRecord = {
      projectId,
      revision,
      workflowJson: workflowJsonBlob,
      sha256: await sha256Blob(workflowJsonBlob),
      createdAt: Date.now(),
    }
    await this.database.checkpoints.put(checkpoint)
    return checkpoint
  }

  async loadCheckpoint(projectId: string): Promise<CheckpointRecord | null> {
    const checkpoint = await this.database.checkpoints.get(projectId)
    if (!checkpoint) return null
    return (await sha256Blob(checkpoint.workflowJson)) === checkpoint.sha256
      ? checkpoint
      : null
  }

  async putPreview(record: PreviewRecord): Promise<void> {
    await this.database.previews.put(record)
  }

  async reclaimPreviews(projectId?: string): Promise<number> {
    const previews = projectId
      ? await this.database.previews
          .where('projectId')
          .equals(projectId)
          .toArray()
      : await this.database.previews.toArray()
    const byteLength = previews.reduce(
      (total, preview) => total + preview.byteLength,
      0,
    )
    await this.database.previews.bulkDelete(
      previews.map((preview) => preview.hash),
    )
    return byteLength
  }

  async claimLease(
    projectId: string,
    tabId: string,
    now = Date.now(),
    durationMilliseconds = 6000,
  ): Promise<LeaseClaimResult> {
    return this.database.transaction('rw', this.database.leases, async () => {
      const existing = await this.database.leases.get(projectId)
      if (existing && existing.expiresAt > now && existing.tabId !== tabId) {
        return { acquired: false, lease: existing }
      }
      const lease: LeaseRecord = {
        projectId,
        tabId,
        token: existing?.tabId === tabId ? existing.token : crypto.randomUUID(),
        expiresAt: now + durationMilliseconds,
        lastRevision: existing?.lastRevision ?? 0,
      }
      await this.database.leases.put(lease)
      return { acquired: true, lease }
    })
  }

  async renewLease(
    projectId: string,
    token: string,
    lastRevision: number,
    now = Date.now(),
    durationMilliseconds = 6000,
  ): Promise<boolean> {
    return this.database.transaction('rw', this.database.leases, async () => {
      const lease = await this.database.leases.get(projectId)
      if (!lease || lease.token !== token || lease.expiresAt <= now)
        return false
      await this.database.leases.update(projectId, {
        expiresAt: now + durationMilliseconds,
        lastRevision,
      })
      return true
    })
  }

  async releaseLease(projectId: string, token: string): Promise<boolean> {
    return this.database.transaction('rw', this.database.leases, async () => {
      const lease = await this.database.leases.get(projectId)
      if (!lease || lease.token !== token) return false
      await this.database.leases.delete(projectId)
      return true
    })
  }

  async loadProject(projectId: string): Promise<LoadedProject | null> {
    const project = await this.database.projects.get(projectId)
    if (!project) return null
    const snapshots = await this.database.snapshots
      .where('projectId')
      .equals(projectId)
      .toArray()
    snapshots.sort((left, right) => right.revision - left.revision)

    const corruptSnapshotIds: string[] = []
    for (const snapshot of snapshots) {
      if (!snapshot.complete) continue
      const actualDigest = await sha256Blob(snapshot.workflowJson)
      if (actualDigest !== snapshot.sha256) {
        corruptSnapshotIds.push(snapshot.id)
        continue
      }
      return {
        project,
        workflowJson: await snapshot.workflowJson.text(),
        snapshot,
        recoveredFromPriorSnapshot: snapshot.id !== project.currentSnapshotId,
        corruptSnapshotIds,
      }
    }
    return null
  }

  async putAsset(
    projectId: string,
    blob: Blob,
    displayName: string,
    roleHint: string,
  ): Promise<string> {
    const digest = await sha256Blob(blob)
    const asset: AssetRecord = {
      digest,
      blob,
      mediaType: blob.type || 'application/octet-stream',
      byteLength: blob.size,
      createdAt: Date.now(),
    }
    await this.database.transaction(
      'rw',
      [this.database.assets, this.database.projectAssets],
      async () => {
        await this.database.assets.put(asset)
        await this.database.projectAssets.put({
          projectId,
          digest,
          displayName,
          roleHint,
          importedAt: Date.now(),
        })
      },
    )
    return digest
  }

  close(): void {
    this.database.close()
  }
}
