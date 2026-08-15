# SPIKE-002 CPU Kernel

## Status

Pass for the prototype architecture. The Rust/WASM SIMD module matches the
independent TypeScript scalar formula exactly on the retained fixtures and the
actual application initializes it through a transferable worker in Microsoft
Edge. This spike does not claim that every production kernel is implemented.

## Commands

```text
cargo test
cargo build --release --target wasm32-unknown-unknown
npm run test:wasm
npm run benchmark:wasm
npm run test:e2e
```

The release build uses `RUSTFLAGS=-C target-feature=+simd128`. The benchmark raw
result is retained in `SPIKE-002-benchmark.json` and identifies the reference
hardware and runtime.

## Result

- Native Rust boundary tests: 3 passed.
- Independent WASM parity vectors: 5 passed; maximum absolute error 0.
- Module size: 16,356 bytes.
- The actual Edge app transferred `[0, 0.5, 1]` to the worker, received
  `[0.25, 0.75, 1]`, and visibly reported `WASM compute` only after conformance.
- The standard 1024-square RGBA fixture stayed below the 100 ms draft-preview
  compute budget in the isolated benchmark.

## Decision

Accept a dependency-free Rust `cdylib` with an explicit C ABI behind the typed
worker protocol. Keep the TypeScript scalar implementation as the independent
oracle and runtime fallback. Transfer ownership of tile buffers and preserve the
protocol version, request, project, revision, and generation on every message.

## Fallback

If WebAssembly initialization or a startup conformance vector fails, process the
same request in the scalar worker and report degraded performance. Do not publish
a nonconformant WASM result.

## ADR

Accepted by `ADR-001-compute-backend.md`.