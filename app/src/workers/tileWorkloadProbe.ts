export interface TileWorkloadRequest {
  generation: number
  activeNodeCount: number
  tileCountPerNode: number
  tileByteLength: number
  concurrency: number
  memoryBudgetBytes: number
}

export interface TileWorkloadResult {
  generation: number
  processedTileCount: number
  peakReservedBytes: number
  published: boolean
  canceled: boolean
}

export class MemoryReservationPool {
  readonly budgetBytes: number
  reservedBytes = 0
  peakReservedBytes = 0

  constructor(budgetBytes: number) {
    if (!Number.isSafeInteger(budgetBytes) || budgetBytes <= 0) {
      throw new Error('Memory budget must be a positive safe integer')
    }
    this.budgetBytes = budgetBytes
  }

  reserve(byteLength: number): () => void {
    if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
      throw new Error('Reservation must be a positive safe integer')
    }
    if (byteLength > this.budgetBytes) {
      throw new Error('Tile exceeds the complete memory budget')
    }
    if (this.reservedBytes + byteLength > this.budgetBytes) {
      throw new Error('Concurrent tile reservations exceed the memory budget')
    }

    this.reservedBytes += byteLength
    this.peakReservedBytes = Math.max(
      this.peakReservedBytes,
      this.reservedBytes,
    )
    let active = true
    return () => {
      if (!active) return
      active = false
      this.reservedBytes -= byteLength
    }
  }
}

export async function runTileWorkloadProbe(
  request: TileWorkloadRequest,
  currentGeneration: () => number,
): Promise<TileWorkloadResult> {
  const pool = new MemoryReservationPool(request.memoryBudgetBytes)
  const workerCount = Math.max(1, Math.min(6, request.concurrency))
  const totalTileCount = request.activeNodeCount * request.tileCountPerNode
  let nextTile = 0
  let processedTileCount = 0

  async function processNextTiles() {
    while (nextTile < totalTileCount) {
      if (currentGeneration() !== request.generation) return
      const tileIndex = nextTile
      nextTile += 1
      const release = pool.reserve(request.tileByteLength)
      try {
        const tile = new Uint8Array(request.tileByteLength)
        tile[0] = tileIndex % 256
        tile[tile.length - 1] = (tileIndex + 1) % 256
        await Promise.resolve()
        if (currentGeneration() !== request.generation) return
        processedTileCount += 1
      } finally {
        release()
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, processNextTiles))
  const canceled = currentGeneration() !== request.generation
  return {
    generation: request.generation,
    processedTileCount,
    peakReservedBytes: pool.peakReservedBytes,
    published: !canceled && processedTileCount === totalTileCount,
    canceled,
  }
}
