import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

const appRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(appRoot, '..')],
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'tests/pages/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
