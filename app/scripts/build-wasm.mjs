import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const repositoryRoot = path.dirname(appRoot)
const crateRoot = path.join(repositoryRoot, 'crates', 'image-kernels')
const source = path.join(
  crateRoot,
  'target',
  'wasm32-unknown-unknown',
  'release',
  'image_kernels.wasm',
)
const outputDirectory = path.join(appRoot, 'public', 'wasm')
const output = path.join(outputDirectory, 'image_kernels.wasm')

execFileSync(
  'cargo',
  ['build', '--release', '--target', 'wasm32-unknown-unknown'],
  {
    cwd: crateRoot,
    env: {
      ...process.env,
      RUSTFLAGS: '-C target-feature=+simd128',
    },
    stdio: 'inherit',
  },
)

mkdirSync(outputDirectory, { recursive: true })
copyFileSync(source, output)
console.log(`WASM kernel ready: ${path.relative(repositoryRoot, output)}`)
