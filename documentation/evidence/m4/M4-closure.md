# M4 Closure

## Outcome

Users can safely import PNG/JPEG assets, connect Load Image to Image Preview, and
see deterministic off-main-thread color or mask pixels. Source blobs persist by
content digest through the persistence worker and restore after reload.

## Import and safety

- PNG/JPEG signature and dimensions are parsed from at most 256 KiB before
  decode. Encoded bytes, dimensions, pixel count, and MIME/signature agreement
  are bounded before persistence or allocation.
- Batch import creates one authored Load Image command per valid file and reports
  invalid members without stopping valid files.
- Worker decode applies browser orientation once, records profile/sRGB fallback
  and normalization versions, zeros transparent RGB, and rejects decoded working
  sets above 256 MiB before `createImageBitmap`.

## Scheduling and preview

- A node-stable two-worker pool owns decode and scalar mask loops. Same-node
  generations supersede stale work; only the newest result publishes.
- Preview identity includes asset digest, mode, source, invert, and draft tier.
  Worker-local LRU caches total at most 64 MiB across the two-worker pool and
  return transferable copies.
- Preview canvas has stable geometry, checkerboard alpha, semantic source size,
  generation, cache-hit, and sampled pixel evidence.

## Numeric evidence

- TypeScript scalar and Rust/WASM mask catalogs implement luminosity, alpha,
  red, green, blue, and invert. Rust tests pass; the independent WebAssembly
  harness now verifies 11 scalar/mask vectors.
- Edge decodes the non-degenerate fixture to `[64,128,191,128]`. Linear mask
  samples are luminosity 52, alpha 128, red 13, green 55, and blue 133; inverted
  alpha is 127. Repeated alpha returns from cache and rapid red→blue edits publish
  only blue.

## Actual-app evidence

Microsoft Edge proves import, typed connection paint, actual canvas pixels, every
mask control, invert, cache reuse, saved authored settings, asset-backed reload,
partial batch failure, and visible pre-allocation memory rejection. The retained
screenshot is `m4-mask-preview.png` with raw mask samples attached.

M5 may now add resize and corrections against the frozen asset, preview-worker,
cache, generation, and mask contracts.