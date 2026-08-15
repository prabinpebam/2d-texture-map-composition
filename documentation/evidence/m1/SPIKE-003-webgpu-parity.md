# SPIKE-003 WebGPU Parity

## Status

Fail for production enablement; the prototype kernel itself passes in Microsoft
Edge. WebGPU remains optional and disabled for product work.

## Command and raw result

`npx playwright test tests/e2e/m1-browser-spikes.spec.ts`

The retained `m1-browser-spike-evidence.json` records an Edge adapter and device,
linear-dodge output `[0,0.25,0.5,1,1]`, maximum absolute error `0`, and device-loss
reason `destroyed`. After device destruction the actual app visibly remains on
the conformant `WASM compute` backend.

## Decision and fallback

The pass condition covers every accelerated P0 kernel across the target browser
and GPU matrix. One kernel on one browser is insufficient. Keep the WebGPU
adapter experimental and dispatch all product work to CPU/WASM. Reopen after the
complete kernel catalog, browser/GPU matrix, error scopes, OOM, and spontaneous
device-loss recovery pass. See `ADR-010-webgpu-enablement.md`.