import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const moduleBytes = await readFile(
  path.join(appRoot, 'public', 'wasm', 'image_kernels.wasm'),
)
const { instance } = await WebAssembly.instantiate(moduleBytes)
const {
  memory,
  allocate_f32: allocate,
  deallocate_f32: deallocate,
} = instance.exports
const processTile = instance.exports.linear_dodge_tile_f32

assert.ok(memory instanceof WebAssembly.Memory)
assert.equal(typeof allocate, 'function')
assert.equal(typeof deallocate, 'function')
assert.equal(typeof processTile, 'function')

const input = new Float32Array([-0.5, 0, 0.25, 0.75, 1])
const expected = Array.from(input, (value) =>
  Math.fround(Math.min(1, Math.max(0, value + 0.25))),
)
const pointer = allocate(input.length)

try {
  new Float32Array(memory.buffer, pointer, input.length).set(input)
  processTile(pointer, input.length, 0.25)
  const result = Array.from(
    new Float32Array(memory.buffer, pointer, input.length),
  )
  result.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) <= 1e-6)
  })
} finally {
  deallocate(pointer, input.length)
}

console.log('WASM parity: 5 scalar branch vectors passed')
