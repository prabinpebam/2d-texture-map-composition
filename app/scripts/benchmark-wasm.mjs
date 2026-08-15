import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const repositoryRoot = path.dirname(appRoot)
const wasmPath = path.join(appRoot, 'public', 'wasm', 'image_kernels.wasm')
const moduleBytes = await readFile(wasmPath)
const { instance } = await WebAssembly.instantiate(moduleBytes)
const {
  memory,
  allocate_f32: allocate,
  deallocate_f32: deallocate,
} = instance.exports
const processTile = instance.exports.linear_dodge_tile_f32

function percentile(samples, fraction) {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ]
}

function makeInput(length) {
  return Float32Array.from({ length }, (_, index) => (index % 257) / 256)
}

function runScalar(input, source) {
  const output = input.slice()
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Math.min(1, Math.max(0, output[index] + source))
  }
  return output
}

function runWasm(input, source) {
  const pointer = allocate(input.length)
  try {
    new Float32Array(memory.buffer, pointer, input.length).set(input)
    processTile(pointer, input.length, source)
    return new Float32Array(
      new Float32Array(memory.buffer, pointer, input.length),
    )
  } finally {
    deallocate(pointer, input.length)
  }
}

function time(operation, iterations) {
  const samples = []
  let output
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const start = performance.now()
    output = operation()
    samples.push(performance.now() - start)
  }
  return { samples, output }
}

const cases = [
  { id: 'small-64-square-rgba', length: 64 * 64 * 4, iterations: 20 },
  { id: 'standard-1024-square-rgba', length: 1024 * 1024 * 4, iterations: 5 },
]
const results = []

for (const benchmarkCase of cases) {
  const input = makeInput(benchmarkCase.length)
  runScalar(input, 0.125)
  runWasm(input, 0.125)

  const scalar = time(() => runScalar(input, 0.125), benchmarkCase.iterations)
  const wasm = time(() => runWasm(input, 0.125), benchmarkCase.iterations)
  let maxAbsoluteError = 0
  for (let index = 0; index < benchmarkCase.length; index += 1) {
    maxAbsoluteError = Math.max(
      maxAbsoluteError,
      Math.abs(scalar.output[index] - wasm.output[index]),
    )
  }

  results.push({
    id: benchmarkCase.id,
    floatCount: benchmarkCase.length,
    byteCount: benchmarkCase.length * Float32Array.BYTES_PER_ELEMENT,
    iterations: benchmarkCase.iterations,
    scalarMilliseconds: {
      median: percentile(scalar.samples, 0.5),
      p95: percentile(scalar.samples, 0.95),
    },
    wasmMilliseconds: {
      median: percentile(wasm.samples, 0.5),
      p95: percentile(wasm.samples, 0.95),
    },
    maxAbsoluteError,
  })
}

const report = {
  spikeId: 'SPIKE-002',
  capturedAt: new Date().toISOString(),
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    logicalProcessors: os.cpus().length,
  },
  wasmBytes: (await stat(wasmPath)).size,
  includesWorkerTransfer: false,
  results,
}

const outputArgument = process.argv.indexOf('--output')
if (outputArgument >= 0) {
  const outputPath = path.resolve(
    repositoryRoot,
    process.argv[outputArgument + 1],
  )
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
}

console.log(JSON.stringify(report, null, 2))
