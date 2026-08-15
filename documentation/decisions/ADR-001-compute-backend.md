# ADR-001: CPU Compute Backend

- Status: Accepted
- Evidence: `documentation/evidence/m1/SPIKE-002-cpu-kernel.md`

## Context

Image kernels must remain deterministic and responsive without placing pixel
loops on the UI thread. The backend must still work when WebAssembly is absent or
fails conformance.

## Decision

Use pure TypeScript scalar kernels as the independent oracle and fallback. Use a
dependency-free Rust `cdylib` compiled to `wasm32-unknown-unknown` as the
production CPU backend. Call it through a versioned transferable worker protocol
with explicit allocation and deallocation. Enable SIMD in the release build but
do not require threads or cross-origin isolation.

## Consequences

The app has no wasm-bindgen runtime dependency and owns a small ABI surface.
Struct-heavy APIs require explicit memory layouts as kernels grow. Every added
kernel must pass the same scalar fixtures before dispatch is enabled. Backend
failure degrades performance but not correctness or availability.