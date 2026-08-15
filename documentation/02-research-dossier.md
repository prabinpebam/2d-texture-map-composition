# Research Dossier

## 1. Scope and Method

This dossier answers the decision questions defined in the detailing plan. It
uses standards and maintainer documentation where available. Sources were
accessed on 2026-08-15. Claims about browser support are time-sensitive and must
be rechecked against the release browser matrix before implementation freezes.

Research closes only when a finding changes a requirement, architecture choice,
test, or explicit experiment. A source list alone is not completion evidence.

## 2. Decision Summary

| ID | Decision | Confidence | Consequence |
| --- | --- | --- | --- |
| RES-001 | Use linear-light, straight-alpha floating-point RGBA as the canonical color raster; premultiply only at defined operation boundaries. | High | Blends, resizing, lighting, and export must declare alpha and transfer handling. |
| RES-002 | Treat tagged images according to their profile when the decoder exposes it; treat untagged images as sRGB. | High | Import records source color metadata and normalization decisions. |
| RES-003 | Define the standard blend catalog from W3C Compositing and Blending, then add a separately named creative-extension catalog. | High | “All blend modes” becomes enumerable and conformance-testable. |
| RES-004 | Use a deterministic CPU/WASM implementation as the oracle; WebGPU is optional acceleration. | High | Unsupported, lost, or failing GPU devices fall back without changing semantics. |
| RES-005 | Run decode, processing, and export outside the UI thread and transfer ownership of large buffers where possible. | High | Worker protocol includes cancellation, generations, progress, and memory accounting. |
| RES-006 | Store project metadata and blobs in IndexedDB; request persistent storage after the user creates or imports durable work. | High | Autosave cannot promise durability without reporting persistence and quota state. |
| RES-007 | Coordinate same-origin tabs and permit one writer per project using BroadcastChannel plus a lease. | Medium | Conflicting tabs open read-only or require explicit takeover. |
| RES-008 | Embed a compressed workflow envelope in PNG ancillary metadata and always offer workflow JSON as the portable authority. | High | Embedded data may be stripped; missing metadata is not image corruption. |
| RES-009 | Use JSON Schema Draft 2020-12, explicit schema versions, bounded input, and sequential migrations. | High | Unknown future major versions open read-only rather than being guessed at. |
| RES-010 | Target WCAG 2.2 AA and provide non-drag alternatives for every graph operation. | High | The graph is a composite keyboard surface with visible focus and command alternatives. |
| RES-011 | Make resampling a versioned kernel registry with named parameters and separate enlargement/minification recommendations. | High | Filter names alone cannot silently change implementation. |
| RES-012 | Preserve HSL as the requested authoring UI but use perceptual color difference for comparison. | High | Show HSL deltas for intent and Delta E for meaningful distance. |
| RES-013 | Strip source EXIF by default on final export and never transmit assets without explicit user action. | High | Local-first behavior and privacy-safe exports are defaults. |

## 3. Findings and Product Implications

### 3.1 Color and alpha

W3C CSS Color distinguishes encoded RGB from linear-light RGB. Encoded RGB is
not additive; operations that model light must first undo the transfer function.
Tagged JPEG, PNG, and TIFF images are to be interpreted in their tagged color
space; untagged images default to sRGB for Web compatibility. HSL resolves to
sRGB and is intuitive, but its lightness and hue spacing are not perceptually
uniform. Oklab is designed for improved perceptual uniformity, while CIEDE2000 is
the established SDR color-difference metric.

PNG stores straight, not premultiplied, alpha. Alpha is a linear coverage value
and is not gamma corrected. W3C compositing applies blend functions to
non-premultiplied colors, then applies Porter-Duff compositing. PNG explicitly
recommends compositing intensity values rather than encoded samples.

**Implications**

- Canonical color pixels are linear-sRGB `Float32` RGBA, straight alpha, with
  finite values. Extended values may exist between operations but are gamut
  mapped and quantized only for preview/export.
- Masks are linear scalar `Float32` values in `[0,1]`; color transfer functions
  never apply to alpha.
- Color blend compatibility modes may intentionally use encoded sRGB, but the
  workflow records the chosen blend space.
- Representative color is alpha-weighted mean linear light, converted to HSL for
  display and Lab for CIEDE2000 comparison.
- Hue delta uses shortest signed angular distance; it is undefined for an
  achromatic source and displayed as “not applicable,” not zero.

### 3.2 Compositing and blend coverage

W3C Compositing and Blending defines normal, multiply, screen, overlay, darken,
lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion,
hue, saturation, color, and luminosity. It also defines Porter-Duff operators
independently from blend functions. Source/backdrop order matters for asymmetric
modes and must not be hidden behind ambiguous A/B naming.

**Implications**

- Standard modes use the W3C formulas and `source-over` compositing.
- Layer order is explicit: `foreground` and `background`; swapping updates both
  labels and processing order.
- Creative extensions are independently identified and include linear burn
  (`max(0, Cb + Cs - 1)`), linear dodge/add (`min(1, Cb + Cs)`), subtract
  (`max(0, Cb - Cs)`), divide (`Cs == 0 ? 1 : min(1, Cb / Cs)`), vivid light,
  linear light, pin light, hard mix, darker color, and lighter color.
- Each mode gets non-degenerate scalar vectors, alpha vectors, and golden images.
  Two differently named modes producing identical fixture output is a failed
  fixture or implementation, not a pass.

### 3.3 Resampling

OpenCV documents nearest, bilinear, bicubic, pixel-area, and Lanczos4, and
recommends area for shrinking and cubic or linear for enlargement. ImageMagick’s
maintainer documentation shows that no filter is universally best: nearest can
alias, Gaussian can blur, and windowed sinc can ring. It also distinguishes
kernel support and parameters that are often hidden behind a name.

**Implications**

- Ship a stable catalog: nearest, box/area, triangle/bilinear, Hermite,
  B-spline, Catmull-Rom, Mitchell-Netravali, Gaussian, Lanczos2, Lanczos3, and
  Lanczos4.
- Default to area for material downscaling and Mitchell-Netravali for upscaling.
  Pixel-art preset uses nearest.
- Filter implementations operate on linear-light premultiplied color for
  resampling, then safely unpremultiply. Masks resample as scalar data. Normal
  maps resample vectors and renormalize per pixel.
- Define edge extension as clamp by default, with transparent and wrap options.
- Exact kernel equations, support, coordinate convention, and no-op behavior are
  serialized by registry version.

### 3.4 Normal, height, and roughness inputs

There is no reliable universal file metadata that distinguishes OpenGL-style
`+Y` from DirectX-style `-Y` tangent-space normal maps, nor a robust heuristic
that can always infer whether an arbitrary RGB image is a normal map. Treating a
height field as an already-encoded normal produces different behavior from
deriving a normal from its gradients.

**Implications**

- Provide explicit interpretation: normal map, height/bump, roughness-as-height,
  or arbitrary image.
- Normal input supports `+Y` and `-Y`, X/Y flip, channel swizzle, strength,
  reconstruct-Z, and normalize. Auto mode may suggest, but never silently lock,
  a convention.
- Height conversion first computes linear luminance or a selected channel, then
  central/Sobel gradients with explicit edge behavior and scale.
- Roughness accepted as a creative relief source follows the same scalar path as
  height but is labeled as an artistic reinterpretation.
- An arbitrary image fallback converts to linear luminance and height-derived
  normals. The UI warns that the result is intentionally unpredictable.

### 3.5 Browser processing architecture

Workers prevent processor-heavy work from blocking the UI. Large `ArrayBuffer`
objects can transfer ownership without copying. OffscreenCanvas is widely
available and transferable, but WebGPU is not Baseline across all widely used
browsers. WebGPU provides compute pipelines, worker access, explicit limits,
asynchronous validation, device loss, and out-of-memory errors.

Shared memory requires HTTPS and cross-origin isolation. Those headers may
restrict embedding and cross-origin assets, so shared memory must be an
optimization rather than a functional requirement.

**Implications**

- Main thread owns interaction only; a scheduler worker owns graph evaluation;
  compute workers own CPU/WASM kernels; an optional WebGPU backend implements the
  same kernel interface.
- Prefer transferable buffers and tiles before introducing shared memory.
- WebGPU activation requires capability and conformance self-tests. Device loss,
  validation, or OOM disables the backend for the session and retries on CPU.
- Do not make GPU/worker initialization, storage checks, or full graph validation
  part of pointer-move or parameter-input hot paths.

### 3.6 Storage and workflow portability

IndexedDB is asynchronous, transactional, available in workers, and supports
Blobs and structured-clone values. Browser-managed storage is best-effort by
default. `navigator.storage.persist()` can request persistent treatment, but the
browser may deny it. Quota and eviction policies vary; quota errors are expected
runtime conditions. In private browsing, data is commonly deleted at session end.

BroadcastChannel supports same-origin cross-context messaging but defines no
locking protocol. React Flow can serialize nodes, edges, and viewport through
`toObject()`, but application state, asset identity, schema version, node
parameters, and history policy remain the product’s responsibility.

**Implications**

- IndexedDB stores projects, graph snapshots, content-addressed assets,
  thumbnails, checkpoints, and settings in separate stores.
- State mutation is synchronous in memory; durable autosave is debounced,
  transactional, observable, and flushed on explicit save/page lifecycle where
  available.
- The app reports `saved`, `saving`, `save failed`, `quota low`, `best effort`,
  and `persistent` states without claiming stronger durability.
- Portable JSON either embeds assets with explicit size warnings or references a
  companion package; bare local database IDs are never presented as portable.

### 3.7 PNG workflow embedding and export codecs

PNG supports optional ancillary chunks, CRC per chunk, compressed UTF-8 iTXt,
and private ancillary chunks. Decoders may ignore ancillary information and
editors may strip it. A chunk can theoretically be very large, but that is not a
practical interoperability target. PNG supports 8/16-bit samples and color
metadata. Browser canvas encoding guarantees PNG; JPEG is broadly available;
TIFF is not part of the native canvas encoding contract.

**Implications**

- Embed a compressed UTF-8 workflow envelope in iTXt under a namespaced keyword,
  containing schema version, compression identifier, byte lengths, and SHA-256.
- Keep embedded workflow data after IDAT so image display is not delayed.
- Default embedded payload cap is 5 MiB compressed. Assets are referenced by
  digest, not embedded, unless a later portable-package decision explicitly
  enables bounded thumbnails/assets.
- Always support separate `.textureflow.json` export/import. Importing a PNG with
  absent, corrupt, oversized, or unknown metadata still imports the pixels.
- PNG and JPEG may use native encoding only after conformance checks. TIFF
  requires a maintained WASM encoder selected by a license, 8/16-bit RGBA,
  metadata, memory, and browser benchmark spike.

### 3.8 Accessibility and graph interaction

WCAG 2.2 AA requires keyboard operation, visible and unobscured focus, non-text
contrast, 24 CSS pixel minimum targets or sufficient spacing, status messages,
and a single-pointer non-drag path for dragging functionality. The ARIA APG
distinguishes focus from selection and recommends one tab stop for composite
widgets with arrow-key internal navigation. React Flow supplies focusable nodes
and edges, arrow movement, automatic panning, ARIA labels, and live updates, but
application-specific controls still need semantics and tests.

**Implications**

- Canvas, node controls, ports, toolbar, inspector, dialogs, and color picker are
  fully keyboard operable.
- Commands exist for add node, connect ports, move, resize, reorder, swap layers,
  bypass, mute, lock, delete, zoom, and fit without drag.
- Visual focus differs from selection. Focus is never hidden behind panels.
- Port type and node state use icon/shape/text in addition to color.
- Progress, save result, graph errors, and export completion use appropriate live
  status semantics without stealing focus.

### 3.9 Untrusted files and privacy

OWASP recommends allowlisted types, signature plus type checks, size limits,
safe names, current parsers, and defense in depth. PNG warns that chunk lengths
can be huge, compressed data can overrun weak decoders, EXIF can expose GPS, and
transparent pixels may retain supposedly hidden content. Blob URLs retain
resources until revoked.

**Implications**

- Validate extension, MIME hint, signature, dimensions, pixel count, decoded
  byte estimate, chunk sizes, and schema structure before allocation.
- Decode in a worker, cap dimensions and aggregate project bytes, and abort on
  budget overrun. Never render imported SVG/HTML as active content.
- Parse JSON into schema-defined records; reject dangerous keys, excessive
  nesting, duplicate IDs, invalid numbers, dangling edges, and expansion bombs.
- Re-encode exports from computed pixels, strip EXIF/location/history by default,
  and revoke Blob URLs when previews/download handles expire.
- No image, workflow, filename, or usage telemetry leaves the device by default.

## 4. Source Matrix

| Topic | Source | Status | Applied decision |
| --- | --- | --- | --- |
| Compositing | [W3C Compositing and Blending Level 1](https://www.w3.org/TR/compositing-1/) | Candidate Recommendation Draft | Blend catalog, formulas, alpha order |
| Color | [W3C CSS Color Level 4](https://www.w3.org/TR/css-color-4/) | Candidate Recommendation Draft | Linear light, tagged/untagged images, HSL limits, Delta E |
| PNG | [PNG Specification, Third Edition](https://www.w3.org/TR/png-3/) | Recommendation | Alpha, color metadata, chunks, CRC, privacy |
| Storage | [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Maintainer reference | Transactional blob/project storage |
| Quota | [MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | Maintainer reference | Durability states and quota handling |
| Persistence | [MDN StorageManager.persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) | Maintainer reference | Explicit persistence request |
| Multi-tab | [MDN Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) | Maintainer reference | Lease messaging transport |
| Workers | [MDN Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) | Maintainer reference | Worker boundary and transferables |
| Canvas | [MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) | Maintainer reference | Worker preview/export surface |
| Decode | [MDN createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap) | Maintainer reference | Orientation and decode options |
| Native encode | [MDN canvas toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) | Maintainer reference | PNG/JPEG baseline; no native TIFF assumption |
| GPU | [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | Limited-availability reference | Optional backend and failure handling |
| Shared memory | [MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) | Maintainer reference | Optional cross-origin-isolated optimization |
| Graph UI | [React Flow performance](https://reactflow.dev/learn/advanced-use/performance) | Maintainer documentation | Narrow subscriptions and stable props |
| Graph state | [React Flow save and restore](https://reactflow.dev/examples/interaction/save-and-restore) | Maintainer documentation | Nodes/edges/viewport capture only |
| Node resize | [React Flow NodeResizer](https://reactflow.dev/api-reference/components/node-resizer) | Maintainer documentation | Resizing constraints and events |
| Graph a11y | [React Flow accessibility](https://reactflow.dev/learn/advanced-use/accessibility) | Maintainer documentation | Built-in keyboard/ARIA baseline |
| Accessibility | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Recommendation | AA target and non-drag alternatives |
| Keyboard | [ARIA APG Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | WAI practice guidance | Composite focus model |
| Resize | [OpenCV geometric transforms](https://docs.opencv.org/4.x/da/d54/group__imgproc__transform.html) | Maintainer documentation | Core interpolation catalog |
| Resize tradeoffs | [ImageMagick resampling filters](https://usage.imagemagick.org/filter/) | Maintainer documentation | Kernel parameters and presets |
| JSON | [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) | Published specification | Workflow schema and validation |
| File safety | [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Security guidance | Layered untrusted-file validation |
| Blob lifecycle | [MDN URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) | Maintainer reference | Explicit URL revocation |

## 5. Required Spikes Before Architecture Freeze

| Spike | Pass condition | Reopens on failure |
| --- | --- | --- |
| SPIKE-001 TIFF codec | Maintained permissive dependency encodes 8/16-bit RGBA TIFF in target browsers within export memory budget and decodes in two independent tools. | Export scope and codec boundary |
| SPIKE-002 CPU kernel | WASM SIMD implementation matches scalar reference fixtures and meets preview budget on reference hardware. | Compute implementation and budgets |
| SPIKE-003 WebGPU parity | Every accelerated P0 kernel matches CPU tolerance across the browser/GPU matrix and recovers from device loss. | GPU milestone only |
| SPIKE-004 Color import | Tagged sRGB, Display-P3, and untagged fixtures decode consistently enough to preserve declared product behavior. | Color-management scope |
| SPIKE-005 Large workflow | Repeated edits on workload tiers meet interaction, memory, cancellation, and autosave budgets without unbounded copies. | Tiling, cache, and scheduler |
| SPIKE-006 PNG envelope | Exported PNG remains viewable in target tools; envelope round-trips; stripped, corrupt, and oversized chunks fail safely. | Metadata encoding only |
| SPIKE-007 Normal heuristics | Suggestions achieve documented confidence on fixture corpus; uncertain cases remain user-controlled. | Auto suggestion, not manual controls |
| SPIKE-008 HSL design source | Referenced design is available and interaction states can be mapped to accessible controls. | Picker visual fidelity only |

## 6. Research Closure

The research workstream is closed for specification drafting. The spikes above
remain implementation-plan gates, not hidden assumptions. If a selected library
or browser feature fails its spike, the smallest dependent architecture decision
must be reopened; unrelated product requirements remain closed.