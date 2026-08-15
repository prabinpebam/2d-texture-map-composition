import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import projectPersistenceSource from './app/projectPersistence.ts?raw'

const componentSources = import.meta.glob('./components/**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

describe('module boundaries', () => {
  it('keeps UI components independent of persistence and processing internals', () => {
    const sources = { './App.tsx': appSource, ...componentSources }

    for (const [sourcePath, source] of Object.entries(sources)) {
      expect(source, sourcePath).not.toMatch(
        /from ['"](?:dexie|.*\/(?:processing|storage|workers)\/)/,
      )
    }
  })

  it('routes app persistence through the worker client', () => {
    expect(projectPersistenceSource).toMatch(
      /from ['"]\.\.\/workers\/persistenceClient['"]/,
    )
    expect(projectPersistenceSource).not.toMatch(
      /from ['"](?:dexie|\.\.\/storage\/)/,
    )
  })
})
