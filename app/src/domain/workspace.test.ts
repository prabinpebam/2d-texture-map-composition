import { describe, expect, it } from 'vitest'
import { NODE_CATALOG, nextTheme } from './workspace'

describe('workspace domain', () => {
  it('uses stable unique catalog identifiers', () => {
    const ids = NODE_CATALOG.map((item) => item.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cycles through every theme preference', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
})
