import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@xyflow') || id.includes('d3-')) return 'graph-ui'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('dexie')) return 'storage'
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-core'
          }
          return undefined
        },
      },
    },
  },
  server: {
    fs: {
      allow: [path.resolve(repositoryRoot, '..')],
    },
  },
})
