import Dexie, { type Table } from 'dexie'

interface AssetRecord {
  digest: string
  bytes: Uint8Array
}

interface SnapshotRecord {
  id: string
  projectId: string
  revision: number
  workflowJson: string
}

interface LeaseRecord {
  projectId: string
  ownerId: string
  token: string
}

class ProbeDatabase extends Dexie {
  assets!: Table<AssetRecord, string>
  snapshots!: Table<SnapshotRecord, string>
  leases!: Table<LeaseRecord, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      assets: 'digest',
      snapshots: 'id, [projectId+revision]',
      leases: 'projectId',
    })
  }
}

export interface PersistenceProbeResult {
  atomicCommit: boolean
  quotaRecovery: boolean
  leaseWinner: string
  leaseConflictRejected: boolean
  broadcastDelivered: boolean
}

async function claimLease(
  database: ProbeDatabase,
  projectId: string,
  ownerId: string,
): Promise<boolean> {
  try {
    await database.leases.add({
      projectId,
      ownerId,
      token: `${ownerId}-token`,
    })
    return true
  } catch (error) {
    if (error instanceof Dexie.ConstraintError) return false
    throw error
  }
}

async function proveBroadcastChannel(channelName: string): Promise<boolean> {
  const sender = new BroadcastChannel(channelName)
  const receiver = new BroadcastChannel(channelName)
  try {
    const received = new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 1000)
      receiver.addEventListener(
        'message',
        (event: MessageEvent<{ type: string }>) => {
          window.clearTimeout(timeout)
          resolve(event.data.type === 'lease-intent')
        },
        { once: true },
      )
    })
    sender.postMessage({ type: 'lease-intent' })
    return await received
  } finally {
    sender.close()
    receiver.close()
  }
}

export async function runPersistenceProbe(): Promise<PersistenceProbeResult> {
  const probeId = crypto.randomUUID()
  const databaseName = `textureflow-m1-probe-${probeId}`
  const primary = new ProbeDatabase(databaseName)
  const contender = new ProbeDatabase(databaseName)
  const projectId = 'probe-project'

  try {
    await primary.open()
    await primary.transaction(
      'rw',
      [primary.assets, primary.snapshots],
      async () => {
        await primary.assets.add({
          digest: 'asset-v1',
          bytes: new Uint8Array([1, 2, 3]),
        })
        await primary.snapshots.add({
          id: 'snapshot-v1',
          projectId,
          revision: 1,
          workflowJson: '{"revision":1}',
        })
      },
    )
    const atomicCommit =
      (await primary.assets.count()) === 1 &&
      (await primary.snapshots.count()) === 1

    try {
      await primary.transaction(
        'rw',
        [primary.assets, primary.snapshots],
        async () => {
          await primary.assets.add({
            digest: 'asset-v2',
            bytes: new Uint8Array([4, 5, 6]),
          })
          await primary.snapshots.add({
            id: 'snapshot-v2',
            projectId,
            revision: 2,
            workflowJson: '{"revision":2}',
          })
          throw new DOMException('Injected quota failure', 'QuotaExceededError')
        },
      )
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'QuotaExceededError'
      )) {
        throw error
      }
    }
    const quotaRecovery =
      (await primary.assets.get('asset-v1')) !== undefined &&
      (await primary.snapshots.get('snapshot-v1')) !== undefined &&
      (await primary.assets.get('asset-v2')) === undefined &&
      (await primary.snapshots.get('snapshot-v2')) === undefined

    await contender.open()
    const [primaryClaimed, contenderClaimed] = await Promise.all([
      claimLease(primary, projectId, 'tab-a'),
      claimLease(contender, projectId, 'tab-b'),
    ])
    const lease = await primary.leases.get(projectId)
    const successfulClaims = Number(primaryClaimed) + Number(contenderClaimed)

    return {
      atomicCommit,
      quotaRecovery,
      leaseWinner: lease?.ownerId ?? 'none',
      leaseConflictRejected: successfulClaims === 1,
      broadcastDelivered: await proveBroadcastChannel(
        `textureflow-m1-lease-${probeId}`,
      ),
    }
  } finally {
    primary.close()
    contender.close()
    await Dexie.delete(databaseName)
  }
}
