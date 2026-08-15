# ADR-010: WebGPU Enablement

- Status: Disabled pending full conformance
- Evidence: `documentation/evidence/m1/SPIKE-003-webgpu-parity.md`

WebGPU is an optional adapter with no unique product logic. Although the Edge
prototype kernel has exact parity and observable device-loss recovery, product
dispatch remains CPU/WASM until every P0 kernel passes the browser/GPU matrix,
OOM and device-loss recovery. Any backend error disables GPU for the session and
retries once on CPU without changing workflow data.