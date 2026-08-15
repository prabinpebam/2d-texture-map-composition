import { describe, expect, it } from 'vitest'
import { detectEnvironment } from './environment'

describe('environment capabilities', () => {
  it('returns explicit booleans for optional browser features', () => {
    const capabilities = detectEnvironment()

    expect(typeof capabilities.indexedDb).toBe('boolean')
    expect(typeof capabilities.persistentStorage).toBe('boolean')
    expect(typeof capabilities.secureContext).toBe('boolean')
    expect(typeof capabilities.workers).toBe('boolean')
  })
})
