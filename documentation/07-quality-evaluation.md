# Quality and Evaluation Strategy

## 1. Quality Outcome

Produce evidence that the application fulfills its product claims, not merely
that code paths execute. Every named mode, node, state, persistence promise, and
workflow must have an objective oracle or a documented human evaluation where an
objective oracle is impossible.

## 2. Evaluation Loop

Each work item follows:

```text
Define observable outcome and failure cases
  -> implement the smallest vertical behavior
  -> capture real output/state without detector shaping
  -> evaluate against explicit oracle
  -> reopen the smallest failing layer
  -> rerun the same check
```

Activity, snapshot generation, and “no exception” are not definitions of done.
Evidence is retained with implementation revision, browser/backend, fixture
digest, algorithm version, and environment.

## 3. Test Layers

| Layer | Proves | Primary tools |
| --- | --- | --- |
| Type/build | package boundaries and message/schema types compile | TypeScript, Rust, Vite |
| Unit | formulas, parsers, commands, reducers, migrations | Vitest, Rust tests |
| Property | invariants over generated valid and invalid values | fast-check, proptest |
| Numeric conformance | CPU/WASM/WebGPU implement the processing contract | vector fixtures, image diff |
| Component | shared components expose behavior, states, and semantics | Testing Library, axe |
| Integration | workers, scheduler, cache, storage, codecs, and domain cooperate | Vitest browser/Playwright |
| End-to-end | real users can complete principal workflows | Playwright real browser |
| Accessibility | WCAG 2.2 AA behavior beyond static rules | axe plus keyboard/screen-reader manual |
| Performance | repeated real workflows meet latency/memory budgets | browser traces, User Timing, WASM/GPU timing |
| Recovery/security | malformed data and failures preserve availability/authored work | fuzz corpus, fault injection |
| Compatibility | target browsers decode, compute, persist, and export equivalently | browser matrix |

### Mandatory actual-app UX evaluation

The validation loop evaluates the user experience: can a user complete the
intended task in the actual application with the expected visible result,
interaction, feedback, and recovery? It is not a loop for proving that functions,
types, or code paths execute. Unit, property, numeric, schema, integration, lint,
typecheck, and build checks remain mandatory engineering evidence, but they do
not answer the UX question and cannot close this loop.

Every meaningful implementation milestone must run Playwright against the actual
application, not a component mock, static DOM fixture, or synthesized client
environment. Playwright starts and owns the app server, opens the app in a real
target browser, and completes the milestone's user task with real pointer and
keyboard input.

The evaluator must observe and retain raw evidence of visible paint, geometry,
clipping, overlap, hit testing, focus, state feedback, error/recovery behavior,
and the final task outcome. It captures screenshots at the states needed to judge
the experience. Canvas, image, mask, and bitmap work additionally proves nonblank
paint and samples semantic pixels/values. DOM presence, classes, ARIA state, or a
successful API response alone never prove that the UX works.

If the intended task cannot be completed in Playwright as a user would complete
it, the experience remains open even when all functional tests pass. If
Playwright cannot open the actual app or target browser, the milestone is blocked
and cannot be committed as complete.

## 4. Fixture Catalog

### Pixel primitives

- Transparent black; transparent colored source bytes; opaque black/white.
- Primary/secondary colors, neutral grays, near-black/near-white, out-of-gamut.
- 1x1, 1xN, odd/even dimensions, mismatched extents, alpha edges.
- Horizontal/vertical/diagonal ramps; hard edges; impulses; checkerboards;
  concentric rings; fine fabric/brick-like frequency patterns.
- Tagged sRGB, Display-P3, malformed profile, untagged, EXIF orientations 1-8.

### Semantic maps

- Flat `+Z` normal; X/Y slopes; sphere; `+Y` and `-Y` pairs; swizzled channels;
  invalid zero vectors; arbitrary photographic image.
- Constant, ramp, step, impulse, noise, and checker height/masks.
- Light directions at cardinal/intercardinal azimuths and elevation boundaries.

### Graphs

- Single chain, diamond fan-out, disconnected components, variadic lights,
  missing required input, dangling edge, duplicate IDs, cycle attempt.
- Small/standard/large workloads from the PRD with deterministic assets.
- Graphs where identical-looking node positions have different computation and
  graphs where different positions have identical computation/cache identity.

### Persistence/import corpus

- Each supported schema version and migration step.
- Unknown major/minor data, extra keys, excessive nesting, duplicate IDs,
  oversized arrays, non-finite number encodings, missing assets.
- Valid/stripped/corrupt/oversized PNG workflow envelopes and CRC failures.
- Quota, aborted transaction, worker crash, tab conflict, and checksum failure.

## 5. Processing Oracles

### Reference hierarchy

1. Closed-form scalar/numeric vector where practical.
2. Pure TypeScript scalar implementation from the processing specification.
3. Independent standards/library decode for exported artifacts.
4. Golden image generated by a reviewed reference and pinned with provenance.

WASM and WebGPU never generate their own expected results. Golden updates require
the reason, before/after metrics, affected algorithm IDs, reviewer, and explicit
approval; a failing test is not fixed by automatic golden replacement.

### Mandatory invariants

- Identity controls preserve input within tolerance.
- Output is finite; alpha and masks stay in range.
- Bypass output has the same content hash as pass-through input.
- Mute emits typed absent, never transparent data masquerading as valid input.
- No-op resize is exact identity/hash.
- Normal outputs have unit length or documented neutral fallback.
- Tile size/order does not alter output beyond tolerance.
- Swapping asymmetric blend layers changes a non-degenerate fixture.
- Every named blend and resize mode differs from at least one sibling on the
  catalog fixture, except explicitly documented mathematical equivalences.
- CPU/WASM/GPU parity stays within contract tolerance.
- Preview refinement and full export agree after matching extent/quantization.
- Node-local and inspector fields bind the same authored key, validation, default,
  reset, undo transaction, and serialized value.
- Draft preview completion creates no workflow run record and cannot mark a stale
  completed output current.
- Full run demands every active output branch; partial run demands only selected
  output ancestors. Undemanded branches produce no execution events.
- A stale run/revision/generation/token completion cannot replace current output.
- Identical clean identities report cached/skipped and do not execute their kernel.

### Image comparison

Store raw dimensions, channel extrema, mean, RMS, max absolute error, differing
pixel count by threshold, and Delta E percentiles. Use exact decoded pixel checks
where deterministic; perceptual metrics supplement but never hide max-error or
alpha defects. Diff images are evidence, not the sole detector.

## 6. Graph and Scheduler Tests

- Property-generate DAGs and verify topological order includes each required node
  once, rejects cycles, and preserves disconnected branches.
- Change one parameter and assert only that node/downstream cache identities
  change; position/selection/theme changes alter none.
- Race generations so older work completes last; assert it cannot publish.
- Cancel between every tile/phase and assert reservations/buffers return to zero.
- Crash each worker during idempotent work; assert at most one controlled retry.
- Saturate export work, then edit a visible node; assert interaction priority is
  maintained.
- Compare full-frame and tiled outputs at every tile boundary and kernel halo.
- Capture full-run and selected-output demanded node sets, topological order, run
  records, per-node events, cache decisions, and final result ownership.
- Race authoring edits against active runs and complete the older run last; assert
  its result remains historical/stale and current output is unchanged.
- Interrupt between queue, reservation, tile, and publication phases; assert the
  run closes canceled, reservations release, and no canceled result publishes.
- Render node widget schemas in node and inspector hosts and property-check
  identical writes/defaults/validation/reset/undo behavior.

## 7. Persistence and Interchange Tests

- Round-trip each P0 node/state/viewport through canonical workflow JSON and
  compare authored models structurally and output hashes semantically.
- Interrupt snapshot commits before/after each IndexedDB operation and reopen.
- Inject quota errors into cache, checkpoint, asset, and snapshot writes; current
  authored state and prior valid snapshot must survive.
- Open two tabs, suspend/expire/take over leases, race commits, and verify no
  silent overwrite.
- Migrate fixture versions sequentially, validate output equivalence, and retain
  original backup.
- Import future major version read-only; export must preserve original bytes or
  unknown data as specified.
- Decode exported PNG/JPEG/TIFF in at least two independent tools/libraries;
  validate dimensions, alpha/background, profile, bit depth, and pixels.
- Strip all PNG ancillary chunks and prove pixel import succeeds while workflow
  restoration becomes unavailable.

## 8. End-to-End Journeys

| E2E ID | Journey | Required evidence |
| --- | --- | --- |
| E2E-001 | New project, batch import, connect, preview | UI actions, graph state, actual preview pixels |
| E2E-002 | Material with default then multiple lights | distinct numeric/pixel outputs and serialized light order |
| E2E-003 | Mask extraction for all five channels | sampled output values and preview interpretation |
| E2E-004 | Resize each catalog method | algorithm dispatch trace plus non-degenerate output summaries |
| E2E-005 | Every standard/creative blend and swap | distinct fixture outputs, alpha values, layer labels |
| E2E-006 | Normal/height/arbitrary image relief | standardized vectors, light-direction pixel evidence, warnings |
| E2E-007 | Representative color with target | swatches, HSL/hex, signed deltas, CIEDE2000 numeric oracle |
| E2E-008 | Bypass/mute/lock by UI and shortcut path | authored states, output semantics, focus and undo |
| E2E-009 | Autosave, reload, recovery | IndexedDB revision/checksum and equivalent recompute |
| E2E-010 | JSON export/import and PNG restoration | schema validation, graph parity, metadata failure cases |
| E2E-011 | PNG/JPEG/TIFF export/cancel | decoded artifact properties; no partial file on cancel |
| E2E-012 | Keyboard-only complete composition | focus log, live messages, no drag dependency |
| E2E-013 | Node-local configure and preview without inspector | real node widget input, no-drag hit tests, in-node bitmap pixels, stable geometry |
| E2E-014 | Run workflow and queue history | captured revision, demanded nodes, node states/progress, queue row, current result |
| E2E-015 | Run selected output branch | selected output identity, exact upstream event set, unrelated branch inactivity |
| E2E-016 | Interrupt and stale run race | cancel feedback, released work, prior result retention, stale completion rejection |
| E2E-017 | Node/inspector field parity | same field edited in both hosts, one authored key, undo and serialization parity |

Playwright must use real event input. DOM presence/classes alone do not prove
visibility or usability. Overlays, menus, dialogs, ports, and previews require
bounding/clipping/hit-test checks and screenshots; canvas/bitmap content requires
nonblank pixel and expected-sample checks.

For node-first journeys, Playwright starts with the inspector closed. Opening the
inspector is allowed only in the explicit parity/detail journey. Evidence must
sample the bitmap inside the output node, prove controls are hit-testable without
moving the node, and record node rectangles before/after loading/running/error to
prove stable geometry.

## 9. Accessibility Evaluation

Automated checks run on every component state and principal view, but release
also requires manual passes:

- Keyboard-only at 100%, 200%, and 400% browser zoom where applicable.
- Windows: current Edge/Chrome with Narrator and at least one widely used screen
  reader available to the team.
- macOS: Safari with VoiceOver before claiming Safari accessibility.
- Forced Colors, light/dark, reduced motion, and text-spacing override.
- Pointer target measurement and non-drag alternatives.
- Focus order/restoration after node deletion, dialogs, drawers, and errors.
- Spoken output for graph outline, ports/edges, progress, save, and validation.

Axe zero-violation output is necessary but not sufficient.

## 10. Performance Evaluation

### Scenarios

1. Cold/warm app startup and project open.
2. Repeated node move/resize/selection without pixel recompute.
3. Slider scrub for cheap and expensive downstream graphs.
4. Add/swap blend and connect/mute lights.
5. Five-minute mixed editing loop on standard workload.
6. Autosave during edits and export during edits.
7. Full-resolution PNG/JPEG/TIFF export.
8. Memory pressure, cache churn, cancellation, and GPU fallback.

Measure input event time, frame tasks, React commits, scheduler queue, cache hit
rate, tile time, transfer bytes/copies, WASM/GPU time, IndexedDB transaction time,
decoded/intermediate/cache memory, and time to release after cancellation.

Performance passes only if repeated scenario percentiles meet PRD budgets and no
monotonic memory growth remains after three warm cycles. A fast isolated kernel
does not compensate for a blocked UI or unbounded copies.

## 11. Security Evaluation

- Fuzz image/chunk/ICC/EXIF and workflow parsers with bounded time/memory.
- Verify extension/MIME/signature disagreement, huge dimensions, compressed
  expansion, invalid CRC/offsets, and decoder crashes fail locally.
- Import JSON containing `__proto__`, `constructor`, markup, URLs, deep trees,
  duplicate IDs, and unknown executable-looking fields; none execute or pollute.
- Check CSP/worker headers, no eval, no unexpected network requests, and no user
  assets in service worker cache.
- Inspect exports to ensure source EXIF/GPS and hidden transparent RGB are absent
  by default; embedded workflow appears only when enabled.
- Audit dependency vulnerabilities, licenses, lockfile integrity, WASM/codec
  provenance, and generated SBOM before release.

## 12. Raw Capture and Detection

Capture is agenda-free: record actual ordered messages, graph model, node
parameters/states, cache events, worker generations, sampled pixels, artifact
metadata, storage revisions, DOM accessibility tree, and performance events.
Capture must not pair, filter, or normalize around a known detector.

Detectors run afterward and produce pass/fail with links to raw evidence. This
separation prevents a capture designed to make one expected check pass while
hiding contradictory product state.

## 13. Release Gates

P0 release is blocked by any of:

- P0 requirement without a passing mapped test/evidence item.
- Processing conformance failure or unexplained backend divergence.
- Data loss/corruption in recovery, migration, quota, or tab-race tests.
- WCAG 2.2 A/AA failure in a principal workflow.
- Unbounded parser, memory, or cancellation behavior.
- Standard workload interaction/preview budgets missed without approved scope or
  architecture correction.
- Critical/high exploitable dependency or parser vulnerability.
- Export artifact not independently decodable with required properties.
- Seed traceability gap or unresolved blocking decision.
- Missing or failing Playwright UX evidence from opening the actual app and
  completing the intended user task for a claimed implementation milestone.
- Principal workflow requires the inspector for ordinary controls/results, or an
  output result is unavailable inside its node.
- Run/partial-run/interrupt/cache/stale behavior lacks objective queue and node
  execution evidence, or a draft preview is represented as a completed run.

## 14. Quality Definition of Done

Quality planning closes when every normative requirement has credible supporting
tests, fixtures expose semantic differences, captures preserve raw evidence,
actual-app Playwright UX evaluation is mandatory for every implementation
milestone, release gates are automated where possible and explicitly manual
otherwise, and failure at a higher level identifies the smallest UX or
implementation loop to reopen.