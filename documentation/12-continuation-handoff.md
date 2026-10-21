# Continuation Handoff

## 1. Purpose

This is the continuation entry point for moving development to another device.
It records the verified repository state on 2026-08-15, the user-directed product
contract, architecture boundaries, evidence, constraints, and the smallest next
work. Read this document before changing code.

Repository after handoff:

- GitHub: `https://github.com/prabinpebam/2d-texture-map-composition`
- Visibility: public
- Live demo: `https://prabinpebam.github.io/2d-texture-map-composition/`
- Primary branch: `master`
- Local project root: `2d-texture-map-composition`
- Web application root: `app/`

The immutable `documentation/seed-spec.md` remains the human-authored source of
intent. Never edit it.

## 2. First Setup on the New Device

Required local tools:

- Windows with current Microsoft Edge.
- Node.js 24.x and an installed npm executable.
- Rust 1.93.x with `wasm32-unknown-unknown` and Clippy.
- Git and GitHub CLI authenticated as `prabinpebam` for publishing.

Package registry rules are mandatory:

- Use `https://packagefeedproxy.microsoft.io/npm/`.
- Do not use Corepack.
- Never fall back to `registry.npmjs.org`.
- Read repository-root `AGENTS.md` before installing or updating anything.

Bootstrap and verify:

```powershell
git clone https://github.com/prabinpebam/2d-texture-map-composition.git
Set-Location 2d-texture-map-composition
npm --prefix app ci
npm --prefix app run check:fast
npm --prefix app run test:e2e
```

Stable ports:

- `4174`: persistent manual-inspection server controlled during development.
- `4173`: reserved for the Playwright-owned app instance. Do not reuse an
  existing server there.

Start manual inspection:

```powershell
npm --prefix app run dev -- --host 127.0.0.1 --port 4174
```

Open `http://127.0.0.1:4174/`.

## 3. Governing Documents

Read in this order:

1. `AGENTS.md`: managed registry, milestone commits, actual-app UX validation.
2. `agent-graph-loop.md`: nested outcomes, definitions of done, and reopening the
   smallest failing loop.
3. `documentation/seed-spec.md`: immutable product intent.
4. `documentation/10-node-first-workbench-update.md`: node-first controls,
   previews, and explicit execution amendment.
5. `documentation/11-comfyui-node-interaction-update.md`: authoritative node
   chrome, sockets, driven widgets, drag/resize, and React Flow implementation.
6. `documentation/03-product-requirements.md`, `05-architecture-runtime-persistence.md`,
   `06-ux-design-system.md`, `07-quality-evaluation.md`, and
   `08-implementation-plan.md`.
7. This handoff for implementation status and next work.

No user-facing surface may mention internal design-source tooling. Do not show
Figma links, node IDs, or screenshots as substitutes for working components.

## 4. Current Product Contract

TextureFlow is a local-first browser workbench for typed 2D image-processing
workflows.

The current user-directed interaction contract is:

- The graph canvas is the primary operating surface.
- Common controls live directly inside nodes.
- Output/source previews render inside their nodes.
- The inspector is optional and schema-driven; it cannot define private fields.
- Node behavior follows ComfyUI where requested: dark compact node chrome,
  title-only drag, four-corner resize, typed circular sockets, curved typed links,
  title rename, reconnect/disconnect, and externally driven widgets.
- Every editable widget has one optional `parameter:<key>` socket. A connection
  drives the effective runtime value while preserving the manual fallback.
- Disconnect restores that fallback through undo and save/reload.
- Library templates drag to the graph. `/` and `Shift+A` open the same searchable
  chooser at viewport center. Empty-canvas double-click opens it at the clicked
  graph coordinate.
- Load Image supports Browse/Replace, direct file drop, clipboard image paste,
  source metadata, and an actual in-node thumbnail.
- Workflow computation is explicit only. Parameter, edge, geometry, selection,
  and viewport edits dispatch no graph evaluation.
- Run workflow and Run branch capture an immutable revision and produce queue
  records. Load Image source-thumbnail decode is ingestion work, not a workflow
  run.
- Existing output remains visible as stale after an edit until another explicit
  Run.
- React Flow owns transient drag/resize rendering. Domain revision, persistence,
  and undo commit once at pointer release.
- The custom-node root stays overflow-visible for Handles and NodeResizer. An
  inset rounded surface owns clipped border/background/selection paint. Internal
  preview regions contain media independently.

## 5. Verified Milestone State

### Closed and retained

- M0: project foundation and quality harness.
- M1: scalar oracle, Rust/WASM worker boundary, capability spikes, ADRs.
- M2: typed graph domain, authored commands, connections, workflow schema and
  round trip.
- M3: worker-owned IndexedDB persistence, snapshots, recovery, project browser,
  migrations, leases, viewport restoration.
- M4: bounded PNG/JPEG import, assets, source/mask preview worker, cache,
  generation cancellation, exact mask pixels.

### Implemented and validated R1 slices

- Shared node-widget schema and node/inspector parity.
- Node-local controls and source/output previews.
- Explicit Run workflow, Run branch, Interrupt, queue/history, demanded-subgraph
  planning, cache state, stale-result rejection.
- Optional inspector and inspector-independent node creation.
- ComfyUI-style title drag, four-corner resize, title rename, sockets, link paint,
  edge disconnect/reconnect, and typed primitive value nodes.
- Effective parameter resolution without mutating manual fallbacks.
- Drag/drop, slash search, Arrow/Enter search, and canvas double-click insertion.
- Load Image Browse/Replace, node drop, clipboard paste, invalid recovery, and
  persisted source thumbnail.
- Native React Flow `useNodesState`/`onNodesChange` transient movement with one
  domain commit at drag stop.
- Explicit-run-only execution; no edit-driven graph preview effect remains.
- Responsive node media that consumes resized bounds without recomputation.
- Rounded inner surface with unclipped external sockets/resizers.
- Reusable raw node-layout capture and independent overflow/hit-test detector.
- Realistic 25-node expanded-control accessibility/performance gate and 300-node
  graph stress gate.

### R1 work that still needs explicit closure or completion

Do not assume all R1 bullets are complete because the core journeys pass.
Remaining or partially implemented items include:

- Collapse/expand authored state and zoom-level detail-reduction policy.
- A true floating selected-node toolbox for all promised high-frequency actions.
- Empty-link-drop compatible-node chooser and complete compatible-target
  highlighting during a link gesture.
- Thorough keyboard operation for socket linking/reconnection beyond the existing
  Connect dialog alternative.
- Undo coalescing for continuous slider gestures rather than one command per
  native change event.
- The optional 100-node intermediate tier if retained as a distinct R1.5 gate;
  25 expanded and 300 stress tiers already pass.
- Update closure/status evidence documents once these residual items are resolved.

### M5 and later

M5 scalar math and worker preview transforms exist for resize, brightness, and
color correction. Node-local controls and exact browser pixels now work through
explicit Run, but the milestone has not received a formal closure document.

M6-M10 remain product work:

- M6 Merge/blend catalogs and processing.
- M7 relief/material/lights.
- M8 representative color and shared accessible picker.
- M9 image export/interchange and PNG workflow restoration.
- M10 integrated hardening and release.

## 6. Current Validation Baseline

At handoff, the last complete gates passed:

```text
npm run check:fast
- Prettier: pass
- ESLint: pass
- Vitest: 26 files / 92 tests pass
- WASM parity: 11 vectors pass
- TypeScript/build: pass

npm run test:e2e
- Microsoft Edge: 35/35 journeys pass
- Browser warnings/errors: none
```

Important retained browser evidence includes:

- M4 exact luminosity/alpha/red/green/blue mask samples and OOM failure.
- M5 exact transform pixels and distinct resize methods.
- Full/partial/cached/canceled/stale run records.
- Unclipped typed sockets and driven-value fallback restoration.
- Live drag and resize with unchanged revision/undo until release.
- Load Image red browse, green drop, blue clipboard paste, invalid recovery,
  reload persistence.
- Portrait Preview matrix: empty/default/tall/wide/compact, zero detected overflow.
- 25 expanded nodes: 85 parameter sockets, no overlap, hit-testable input,
  sub-100 ms event-to-paint, zero axe violations.
- 300 nodes: rendered count, Home event-to-paint under 100 ms, hit-test evidence.

Playwright evidence is generated under `app/test-results/` and is normally ignored
by Git. Re-run tests on the new device; do not treat copied generated artifacts as
a substitute for current execution.

## 7. Architecture Map

### Authored graph

- `app/src/domain/graph.ts`: node/edge contracts, static and generated ports,
  connection validation, canonical default dimensions.
- `app/src/domain/nodeWidgetSchema.ts`: field definitions, defaults, validation,
  serialization keys, and parameter socket types.
- `app/src/domain/effectiveParameters.ts`: resolves connected values over manual
  fallback without mutation.
- `app/src/domain/graphStore.ts`: canonical authored document, revision, selection,
  undo/redo, geometry, rename, edge connect/disconnect/reconnect.
- `app/src/app/graphState.ts`: React binding to the graph store.

### React Flow presentation

- `app/src/App.tsx`: composition root and React Flow adapter.
- `app/src/components/WorkflowNode.tsx`: node shell, source/output preview hosts,
  title, resizer, semantic sockets.
- `app/src/components/NodeWidgetFields.tsx`: shared node/inspector fields and
  parameter sockets.
- `app/src/components/NodeSearchDialog.tsx`: shared insertion chooser.
- React Flow uses local `useNodesState` plus `onNodesChange` for transient
  movement/resize. Authored projection reconciles only non-dragging nodes.
- `nodeTypes` is defined outside the component.

### Execution and previews

- `app/src/domain/runPlanning.ts`: demanded output subgraph and validation.
- `app/src/workers/runQueueProtocol.ts`, `runQueue.worker.ts`,
  `runQueueClient.ts`: explicit-run queue boundary and state.
- `app/src/app/runQueue.ts`: React-facing run boundary.
- `app/src/app/previewGraph.ts`: resolves source/output branches and operations.
- `app/src/app/previewState.ts`: current/previous node result registry.
- `app/src/workers/imagePreviewProtocol.ts`, `imagePreview.worker.ts`,
  `imagePreviewClient.ts`: bounded decode/transform/cache/generation worker.
- `app/src/app/imageAssets.ts`: source import/persistence/preview application
  boundary.
- Only explicit Run invokes output branch rendering. The automatic effect in
  `App.tsx` is limited to Load Image source thumbnails.

### Persistence

- `app/src/workers/persistenceProtocol.ts`, `persistence.worker.ts`,
  `persistenceClient.ts`: all database ownership.
- `app/src/storage/projectRepository.ts`: Dexie implementation, checksums,
  snapshots, assets, quota, migration, leases.
- `app/src/app/projectPersistence.ts`: React boundary for autosave, lifecycle,
  leases, viewport, and durability.
- UI components must not import Dexie, storage internals, processing internals, or
  worker modules directly. `app/src/architecture-boundaries.test.ts` enforces it.

### Compute

- `app/src/processing/`: independent TypeScript scalar oracle and M5 transforms.
- `crates/image-kernels/`: Rust/WASM production CPU kernels.
- `app/src/workers/computeProtocol.ts` and `compute.worker.ts`: versioned compute
  boundary.
- WebGPU, TIFF, wide-gamut, and automatic normal suggestion remain gated by M1
  evidence.

## 8. High-Load Invariants and Lessons

Do not regress these:

1. Never place persistence I/O or index checks on a user interaction hot path.
2. Workflow search/evaluation paths and background maintenance are separate.
3. Graph edits never evaluate the workflow. Run is explicit.
4. Source-thumbnail decode cannot publish downstream output or run history.
5. React Flow owns transient geometry. Do not mirror every pointer move into the
   canonical graph store or rebuild heavy node data during drag.
6. Large RGBA buffers live in the preview registry, not React Flow node `data`.
7. A stale run cannot replace current output.
8. Cache-hit output still passes through the result bridge so cached pixels are
   republished, not merely labeled cached.
9. Outer node overflow remains visible for socket hit targets. Internal rounded
   surface and media tracks own clipping.
10. Validators must inspect actual paint, geometry, hit testing, and pixels, not
    only tokens, classes, or DOM presence.
11. The inspector cannot be required for the principal workflow.
12. Every named mode must dispatch distinct behavior on a non-degenerate fixture.

## 9. Evaluation System

Every meaningful UI milestone must use Playwright against the actual app in
Microsoft Edge. Playwright owns port `4173` and uses real pointer/keyboard input.
Functional tests are supporting evidence only.

Reusable geometry evaluation:

- `app/tests/e2e/nodeLayoutAudit.ts` captures raw descendant rectangles, styles,
  visibility, overflow, scroll extents, and hit testing.
- `app/tests/e2e/r1-node-layout.spec.ts` runs the independent detector over a
  portrait Preview in empty/default/tall/wide/compact states.
- Only Handle and NodeResizer affordances may cross the owner rectangle.
- The inner rounded surface must exactly cover the node owner, have nonzero radius,
  and use hidden overflow.

Before a milestone commit:

1. Run the focused failing/user journey.
2. Run `npm run check:fast`.
3. Run applicable Edge journeys or `npm run test:e2e`.
4. Inspect status and staged diff; do not include unrelated user changes.
5. Commit the independently reviewable result. Do not push unless explicitly
   authorized.

## 10. Current Git Milestones

Key checkpoints:

| Commit | Outcome |
| --- | --- |
| `d9dc6b1` | M0 foundation |
| `7bb06f9` | M1 closure |
| `6c9cde3` | M2 closure |
| `e98d29b` | M3 closure |
| `a550099` | M4 worker import/preview pipeline |
| `d3ac1e2` | M5 resize reference catalog |
| `a523eab` | M5 brightness oracle |
| `2050896` | M5 color correction oracle |
| `eec5768` | Node-first specification rebaseline |
| `f7055de` | Node-local controls and previews |
| `760b591` | Comfy-style node workbench interactions |
| `1b87f38` | Explicit workflow execution |
| `56f0460` | Responsive rounded node hardening |

Use `git log --oneline --decorate` for the full history.

## 11. Recommended Next Loop

Close the smallest remaining R1 behavior rather than beginning several downstream
features at once.

Recommended order:

1. Implement authored collapse/expand and zoom-level detail reduction without
   changing ports, values, or result ownership.
2. Add the selected-node toolbox and complete empty-link compatible-node chooser/
   target highlighting.
3. Prove keyboard alternatives and continuous-edit undo coalescing.
4. Re-run R1 exit evidence and write/update a formal R1 closure record.
5. Resume and formally close M5 with the complete resize catalog, correction
   identities, explicit-run UX, and worker/scalar parity.
6. Continue M6 through M10 in dependency order from
   `documentation/08-implementation-plan.md`.

For any failure, reopen the smallest owning layer. Do not optimize around a failed
product oracle.

## 12. Handoff Sanity Checklist

Before continuing on the new device, verify:

- Active GitHub account is `prpebam_microsoft`.
- Repository visibility is private.
- `master` tracks `origin/master`.
- Working tree is clean.
- Managed npm registry is effective.
- Rust WASM target and Edge are available.
- `npm --prefix app run check:fast` passes.
- `npm --prefix app run test:e2e` passes in Edge.
- A manual server opens on `http://127.0.0.1:4174/` when needed.

If any item fails, fix that environment/repository loop before implementing new
product behavior.
