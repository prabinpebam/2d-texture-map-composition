/// <reference lib="webworker" />

import {
  isComputeRequest,
  type ComputeFailure,
  type ComputeResponse,
  type LinearDodgeRequest,
} from './computeProtocol'

interface KernelExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory
  allocate_f32(length: number): number
  deallocate_f32(pointer: number, length: number): void
  linear_dodge_tile_f32(pointer: number, length: number, source: number): void
}

const workerScope: DedicatedWorkerGlobalScope =
  self as DedicatedWorkerGlobalScope
let wasmBackend: Promise<KernelExports> | null = null

function responseContext(request: LinearDodgeRequest) {
  return {
    protocolVersion: request.protocolVersion,
    requestId: request.requestId,
    projectId: request.projectId,
    revision: request.revision,
    generation: request.generation,
  }
}

async function loadWasm(): Promise<KernelExports> {
  wasmBackend ??= WebAssembly.instantiateStreaming(
    fetch(`${import.meta.env.BASE_URL}wasm/image_kernels.wasm`),
  ).then(({ instance }) => instance.exports as KernelExports)
  return wasmBackend
}

async function processWithWasm(request: LinearDodgeRequest): Promise<void> {
  const exports = await loadWasm()
  const input = new Float32Array(request.pixels)
  const pointer = exports.allocate_f32(input.length)
  try {
    new Float32Array(exports.memory.buffer, pointer, input.length).set(input)
    exports.linear_dodge_tile_f32(pointer, input.length, request.source)
    input.set(new Float32Array(exports.memory.buffer, pointer, input.length))
  } finally {
    exports.deallocate_f32(pointer, input.length)
  }
}

function processWithScalar(request: LinearDodgeRequest): void {
  const input = new Float32Array(request.pixels)
  for (let index = 0; index < input.length; index += 1) {
    input[index] = Math.min(1, Math.max(0, input[index] + request.source))
  }
}

async function processRequest(request: LinearDodgeRequest) {
  let backend: 'wasm' | 'scalar' = 'wasm'
  try {
    await processWithWasm(request)
  } catch {
    backend = 'scalar'
    processWithScalar(request)
  }

  const response: ComputeResponse = {
    ...responseContext(request),
    type: 'compute-result',
    backend,
    pixels: request.pixels,
  }
  workerScope.postMessage(response, [response.pixels])
}

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isComputeRequest(event.data)) {
    const failure: ComputeFailure = {
      protocolVersion: 1,
      type: 'compute-failure',
      requestId: 'unknown',
      projectId: 'unknown',
      revision: 0,
      generation: 0,
      diagnostic: 'Unknown or invalid compute worker message',
    }
    workerScope.postMessage(failure)
    return
  }

  void processRequest(event.data)
})
