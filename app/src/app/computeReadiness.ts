import {
  COMPUTE_PROTOCOL_VERSION,
  type ComputeResponse,
  type LinearDodgeRequest,
} from '../workers/computeProtocol'

export interface ComputeProbeResult {
  backend: 'wasm' | 'scalar'
  sample: readonly number[]
}

export async function probeComputeBackend(): Promise<ComputeProbeResult> {
  const worker = new Worker(
    new URL('../workers/compute.worker.ts', import.meta.url),
    {
      name: 'textureflow-compute-probe',
      type: 'module',
    },
  )
  const input = new Float32Array([0, 0.5, 1])
  const request: LinearDodgeRequest = {
    protocolVersion: COMPUTE_PROTOCOL_VERSION,
    type: 'process-linear-dodge',
    requestId: 'startup-compute-probe',
    projectId: 'startup',
    revision: 0,
    generation: 0,
    pixels: input.buffer,
    source: 0.25,
  }

  try {
    return await new Promise<ComputeProbeResult>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('Compute worker probe timed out')),
        5000,
      )

      worker.addEventListener('error', () => {
        window.clearTimeout(timeout)
        reject(new Error('Compute worker failed to start'))
      })
      worker.addEventListener(
        'message',
        (event: MessageEvent<ComputeResponse>) => {
          window.clearTimeout(timeout)
          const response = event.data
          if (
            response.type !== 'compute-result' ||
            response.requestId !== request.requestId
          ) {
            reject(new Error('Compute worker returned an invalid response'))
            return
          }

          const sample = Array.from(new Float32Array(response.pixels))
          const expected = [0.25, 0.75, 1]
          const isConformant = sample.every(
            (value, index) => Math.abs(value - expected[index]) <= 1e-6,
          )
          if (!isConformant) {
            reject(new Error('Compute worker failed startup conformance'))
            return
          }
          resolve({ backend: response.backend, sample })
        },
      )
      worker.postMessage(request, [request.pixels])
    })
  } finally {
    worker.terminate()
  }
}
