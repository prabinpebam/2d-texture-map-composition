import { describe, expect, it } from 'vitest'
import {
  MemoryReservationPool,
  runTileWorkloadProbe,
} from './tileWorkloadProbe'

const mebibyte = 1024 * 1024

describe('bounded tile workload probe', () => {
  it('processes a standard logical workflow inside the reservation budget', async () => {
    const result = await runTileWorkloadProbe(
      {
        generation: 4,
        activeNodeCount: 20,
        tileCountPerNode: 4,
        tileByteLength: 4 * mebibyte,
        concurrency: 6,
        memoryBudgetBytes: 256 * mebibyte,
      },
      () => 4,
    )

    expect(result.processedTileCount).toBe(80)
    expect(result.peakReservedBytes).toBeLessThanOrEqual(24 * mebibyte)
    expect(result.published).toBe(true)
    expect(result.canceled).toBe(false)
  })

  it('prevents an older generation from publishing', async () => {
    const result = await runTileWorkloadProbe(
      {
        generation: 3,
        activeNodeCount: 300,
        tileCountPerNode: 16,
        tileByteLength: mebibyte,
        concurrency: 6,
        memoryBudgetBytes: 256 * mebibyte,
      },
      () => 4,
    )

    expect(result.processedTileCount).toBe(0)
    expect(result.published).toBe(false)
    expect(result.canceled).toBe(true)
  })

  it('fails before allocating a tile larger than the budget', () => {
    const pool = new MemoryReservationPool(8 * mebibyte)
    expect(() => pool.reserve(9 * mebibyte)).toThrow(
      'Tile exceeds the complete memory budget',
    )
    expect(pool.reservedBytes).toBe(0)
  })
})
