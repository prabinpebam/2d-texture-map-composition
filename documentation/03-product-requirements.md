# Product Requirements Specification

## 1. Product Definition

The product is a local-first web application for composing final 2D raster
images from texture maps and ordinary images through a visual node graph. It
turns base color, opacity, normal, height, bump, displacement, roughness, masks,
lights, corrections, resizing, and blends into an inspectable, reproducible 2D
result. It does not render or export 3D geometry.

The application favors immediate creative iteration without sacrificing exact
workflow restoration. A useful result must remain possible when inputs are
imperfect: unusual images can be interpreted as masks or relief sources, with
explicit controls and warnings rather than silent rejection.

Normative keywords `must`, `should`, and `may` indicate required, recommended,
and optional behavior. P0 is launch-critical, P1 completes the intended product,
and P2 is deferred enhancement.

## 2. Users and Jobs

### Primary users

- Texture and graphic artists combining downloaded or generated map sets.
- Designers evaluating whether a texture can replace a flat fill color.
- Creative technologists experimenting with 2D relief and lighting effects.

### Core jobs

1. Import a set of heterogeneous images without destructive preprocessing.
2. Convert images into color, masks, normals, or relief data.
3. Combine and correct them visually through a node graph.
4. Preview intermediate and final outputs at useful quality while editing.
5. Save and restore the authored workflow exactly.
6. exchange a workflow independently of one browser database.
7. Export a final PNG, JPEG, or TIFF and optionally recover its workflow from
   PNG metadata.

## 3. Scope

### In scope

- Desktop-class responsive browser application using React Flow.
- Local image import, local processing, IndexedDB persistence, and file export.
- Load Image, Material, Resize, Color Correction, Brightness Correction, Merge,
  Light, Image to Single Color, and Image Preview nodes.
- Typed graph ports, multiple lights, masks, standard and creative blend modes,
  normal/height standardization, deterministic workflow JSON, undo/redo,
  minimap, themes, keyboard access, and autosave/recovery.

### Explicit non-goals

- 3D scene, mesh, camera, UV, PBR renderer, ray tracing, or 3D file export.
- Cloud accounts, collaboration, remote asset hosting, or server rendering in P0/P1.
- Animation or video timelines.
- Arbitrary scripts, plugins, shader code, or network URLs in imported workflows.
- Claims of print-proof color accuracy without a separately validated color
  management and printer-profile feature.

## 4. Product Principles

- **Visible dataflow:** output changes are explained by explicit nodes and edges;
  no hidden graph-wide image source affects evaluation.
- **Node-first operation:** ordinary controls and results live in their owning
  nodes; the inspector is optional for the principal composition workflow.
- **Explicit execution:** authored edits and draft feedback are distinct from a
  captured workflow run, queue record, or completed current result.
- **Forgiving input, explicit interpretation:** arbitrary images are accepted
  within safety limits, while interpretation and uncertainty are visible.
- **Fast interaction, independent processing:** graph editing never waits for
  storage, full-resolution export, or graph-wide recomputation.
- **Reproducible by contract:** saved parameters, assets, schema, and algorithm
  versions are sufficient to regenerate equivalent output.
- **Local by default:** imported content is not uploaded or telemetered.
- **Accessible equivalence:** dragging and color-dependent visuals always have
  operable alternatives.

## 5. Vocabulary and State Semantics

| Term | Normative meaning |
| --- | --- |
| Image | A bounded 2D color raster with alpha and color metadata. |
| Mask | A bounded scalar raster where 0 excludes and 1 fully includes. |
| Normal | A bounded raster of normalized 3D direction vectors used only for 2D shading. |
| Height | A bounded scalar raster interpreted as relative relief. |
| Material | A 2D base image plus optional opacity/relief inputs and zero or more lights. |
| Light | A parallel directional light with direction, intensity, color, and color mix. |
| Workflow | Portable authored graph state and algorithm settings; assets are included only when explicitly packaged. |
| Project | Workflow plus locally stored assets, checkpoints, settings, and metadata. |
| Bypass | Node outputs its designated pass-through input unchanged and ignores its processing controls. |
| Mute | Node emits an absent value. A required downstream input becomes invalid; a muted light contributes no light. |
| Lock | Node cannot be moved, resized, deleted, reconnected, or edited until unlocked; evaluation is unchanged. |
| Invalid | Node cannot evaluate because a required input, parameter, asset, or type contract is missing or incompatible. |
| Stale | A prior preview is visible while a newer generation is queued or computing. |
| Dirty | Authored state differs from the latest completed run for that node or branch. |
| Run | Immutable execution request capturing project revision, demanded output nodes, and settings. |
| Queue | Ordered pending/running/recent run records; queue state is ephemeral, not authored workflow state. |
| Cached | Node output was reused because its complete execution identity matched. |

Bypass, mute, lock, selection, focus, error, computing, and stale are independent
state axes. Shortcuts never fire while a text field, numeric field, or editable
color value consumes the keystroke.

## 6. Principal Workflows

### WF-001 Create and compose

1. User creates a blank project.
2. User imports one or more supported image files.
3. Each file creates a Load Image node positioned without overlap.
4. User adds processing/material/preview nodes and connects compatible ports.
5. User edits ordinary parameters directly inside nodes; a bounded draft may
  update while affected downstream nodes become dirty/stale.
6. User runs the workflow or runs a selected output branch. Nodes display queued,
  running, cached, succeeded, or error state and output nodes show results in-node.
7. The project autosaves authored state independently of run completion and
  reports durability state.

**Acceptance:** closing and reopening restores nodes, edges, values, dimensions,
positions, z-order, viewport, theme, and assets; equivalent output recomputes.

### WF-002 Build a material

1. User supplies a color image or solid HSL/hex color as base color.
2. User optionally connects opacity and one relief source.
3. User connects zero or more Light nodes.
4. With zero connected lights, a visible implicit default light shades from
   northwest toward southeast; its parameters can be materialized as a Light node.

**Acceptance:** adding the first explicit light replaces the implicit default;
muting all explicit lights produces unlit base color rather than reviving the
default. This prevents surprising state changes.

### WF-003 Compare texture with target color

1. User connects an image to Image to Single Color.
2. Node shows representative swatch, HSL, hex, and calculation status.
3. User optionally sets target through the common picker or hex input.
4. Node shows source and target side by side, signed H/S/L deltas, and CIEDE2000.

**Acceptance:** transparent pixels do not skew the representative color; a fully
transparent image reports no representative color rather than black.

### WF-004 Export and restore

1. User connects a result to Image Preview and chooses format/options.
2. Export validates full-resolution graph, estimates memory, then processes with
   progress and cancellation.
3. PNG optionally receives the workflow envelope; JSON can always be exported.
4. Importing a PNG offers workflow restoration only when valid metadata exists.

**Acceptance:** an ordinary or metadata-stripped PNG imports as an image without
error; corrupt workflow metadata is reported separately from pixel decode.

### WF-005 Recover from interruption

1. Browser or tab closes during editing or processing.
2. On return, app opens the latest committed snapshot and identifies any newer
   recoverable checkpoint.
3. User can restore or discard the checkpoint without overwriting the last good
   snapshot first.

**Acceptance:** simulated interruption during any write leaves either the prior
complete snapshot or the next complete snapshot, never a mixed project.

## 7. Functional Requirements

### 7.1 Project and workspace

- **PRJ-001 P0:** The app must create, rename, duplicate, open, and delete local
  projects. Delete requires confirmation and supports undo until the app session
  ends or trash is explicitly emptied.
- **PRJ-002 P0:** Project list must show name, modified time, thumbnail when
  available, asset/storage estimate, and durability warning.
- **PRJ-003 P0:** The workspace must contain node library, graph canvas, inspector,
  node-local preview surfaces, run/queue controls, queue/history panel, toolbar,
  minimap, and status/progress regions. The inspector is a secondary detail panel.
- **PRJ-004 P0:** Light, dark, and system themes must be available and persisted as
  user preference without changing workflow output.
- **PRJ-005 P0:** Undo and redo must cover graph and parameter authoring commands.
  Autosave, preview completion, selection, and viewport-only panning are not
  authored undo commands.
- **PRJ-006 P0:** The app must remain usable at 1280x720 and browser zoom to 200%.
  At narrower widths, secondary panels become drawers while the graph retains
  two-dimensional scrolling.

### 7.2 Import and assets

- **AST-001 P0:** File chooser and drag/drop must accept PNG and JPEG; TIFF input
  is P1 contingent on the codec spike. File signature and decoded bounds must be
  validated independently of extension/MIME.
- **AST-002 P0:** Default limits are 100 MiB encoded per file, 268 megapixels per
  decoded image, 32,768 pixels per dimension, and a 1 GiB project asset budget.
  Lower runtime budgets may be applied after memory capability checks.
- **AST-003 P0:** Import must preserve original bytes for project portability and
  create a content digest so duplicate imports reuse storage.
- **AST-004 P0:** Source orientation must be normalized once and recorded. Node
  dimensions always describe the oriented image.
- **AST-005 P0:** Import failure must name the file and failure class without
  invalidating other files in the same batch.
- **AST-006 P1:** Replace Asset must preserve downstream edges, show dimension/
  alpha/profile differences, and create one undoable command.

### 7.3 Graph authoring

- **GPH-001 P0:** Users must add nodes by library, searchable command palette,
  context menu, or keyboard command.
- **GPH-002 P0:** Ports must permit only compatible typed edges; attempted invalid
  connections explain expected and actual types.
- **GPH-003 P0:** The graph must be acyclic. An edge that would create a cycle is
  rejected before mutation.
- **GPH-004 P0:** Required ports accept one edge; optional ports accept zero or
  one; variadic light ports accept ordered multiple edges.
- **GPH-005 P0:** Nodes support selection, multiselection, move, resize, duplicate,
  delete, bypass (`Ctrl+B`), mute (`Ctrl+M`), lock (`Ctrl+L`), and contextual
  toolbar/menu equivalents.
- **GPH-006 P0:** Lock applies to the selected nodes and must not prevent reading,
  previewing, copying values, or unlocking.
- **GPH-007 P0:** Zoom in/out, reset to 100%, fit graph, fit selection, minimap
  navigation, pan, and centered focus must have toolbar and keyboard paths.
- **GPH-008 P0:** Node position, size, z-order, authored state, and parameter value
  must update in memory immediately and enter autosave after each completed
  command. Continuous drag/resize becomes one command at pointer/key release.
- **GPH-009 P1:** Copy/paste and duplicate must generate new IDs, preserve internal
  edges among copied nodes, and never retain external edges accidentally.
- **GPH-010 P1:** Users may add frames/groups for organization; groups do not alter
  processing semantics.
- **GPH-011 P0:** Every node template in the library is draggable. Dropping it on
  the graph creates one node centered at the pointer's graph-space coordinate;
  dropping outside the graph creates no mutation.
- **GPH-012 P0:** Pressing `/` while graph commands are available opens a centered
  searchable node chooser. Typing filters by label, category, and summary;
  pointer selection or Arrow Up/Down plus Enter inserts the chosen node at the
  center of the current visible graph framing.
- **GPH-013 P0:** Double-clicking empty canvas opens the same searchable chooser
  and inserts the chosen node centered at the double-click graph coordinate.
  Escape cancels without mutation and focus returns to the graph.

### 7.4 Common node contract

- **NOD-001 P0:** Every node must display name, type icon, preview/status, typed
  ports, bypass/mute/lock state, error summary, and processing progress where
  applicable.
- **NOD-002 P0:** Every ordinary P0 parameter must be operable directly inside its
  node with unit, valid range, current value, default/reset, and accessible name.
  The inspector mirrors the same schema and adds advanced/detail views; it cannot
  define different fields, defaults, validation, or serialization.
- **NOD-003 P0:** Parameter editing must support pointer, keyboard, and direct
  numeric/text entry where meaningful. Node widgets must not drag or pan the node
  while being operated and continuous edits coalesce into one undo command.
- **NOD-004 P0:** A node must reject stale worker output whose project, node,
  revision, or generation no longer matches current state.
- **NOD-005 P0:** Bypass designates a typed pass-through input per node contract.
  Source and analysis nodes with no valid pass-through disable bypass and explain
  why.
- **NOD-006 P0:** Errors propagate as typed absent results with provenance; one
  failing branch must not stop unrelated previews.
- **NOD-007 P0:** Image-producing and analysis/output nodes must render their
  current result directly in the node. Loading, stale, running, cached, canceled,
  error, empty, and OOM states retain stable node geometry.
- **NOD-008 P0:** Nodes support collapse/expand and zoom-level detail reduction.
  Compact state preserves title, typed ports, execution state, and result
  availability without altering authored values.
- **NOD-009 P0:** Selected nodes expose nearby management for context-appropriate
  Run partial, bypass, mute, lock, duplicate, and delete; the context menu remains
  the complete equivalent command surface.
- **NOD-010 P0:** Node title bars are the pointer drag surface and nodes resize
  from every corner. Widgets, previews, sockets, and body commands never move the
  node. Node chrome, socket placement, links, and direct connection gestures
  follow the authoritative ComfyUI interaction amendment.
- **NOD-011 P0:** Every editable node widget declares one typed optional parameter
  input socket. A valid incoming edge drives the effective runtime value and
  disables manual editing without overwriting the authored fallback value.
- **NOD-012 P0:** Disconnecting a parameter edge restores the exact manual
  fallback. Connection/disconnection, undo/redo, save/reload, validation, and
  cache identity preserve both fallback and driven-value semantics.
- **NOD-013 P0:** Dragging a connected input detaches/reconnects it; releasing an
  output connection on empty canvas opens a compatible-node chooser at the
  release point. Incompatible types cannot commit.
- **NOD-014 P0:** Socket circles and their minimum 24 px pointer targets must
  straddle the node boundary without being clipped by node overflow, previews,
  resize controls, selection paint, or compact/detail modes.
- **NOD-015 P0:** A title drag must repaint the node continuously under the
  pointer. Only pointer release commits the authored position, revision, autosave,
  and one undo entry; cancel restores the starting position.
- **NOD-016 P0:** Resizing must reallocate node content continuously. Preview,
  source-thumbnail, swatch, and result surfaces consume available node width and
  height, preserve their media aspect ratio, and grow/shrink with the frame.
  Controls reflow within readable minimums. Resize itself dispatches no workflow
  compute and commits one authored size on release.

### 7.4A Workflow execution and queue

- **EXE-001 P0:** Run workflow is a visible top-level command with reliable
  `Ctrl+Enter` access. It validates and captures one immutable project revision
  and enqueues the demanded output set.
- **EXE-002 P0:** Run selected output is available only for output-capable nodes
  and evaluates exactly the required upstream subgraph for those outputs.
- **EXE-003 P0:** Interrupt cancels queued/running generations, releases
  reservations, and retains the newest prior valid result. Canceled work cannot
  publish current output.
- **EXE-004 P0:** Queue/history records expose run ID, captured revision, targets,
  queued/running/succeeded/failed/canceled state, timestamps, progress,
  diagnostics, and result references. Queue/history is not workflow JSON.
- **EXE-005 P0:** Nodes visibly distinguish dirty, queued, running, cached/skipped,
  succeeded, stale-result, error, and canceled state without relying on color.
- **EXE-006 P0:** A completion whose project revision, run ID, node generation, or
  request token is stale cannot replace current node output.
- **EXE-007 P0:** Identical clean nodes reuse cache during a run and report cached
  state; authored parameter/edge/asset changes invalidate only affected downstream
  identities.
- **EXE-008 P0:** Autosave and draft preview never create a completed run record or
  relabel stale results as current. Authored edits do not dispatch workflow
  evaluation at all; only explicit Run workflow/Run branch does. Run completion
  never relabels unsaved authored edits as saved.
- **EXE-009 P0:** Source-file sniffing and a Load Image node's own bounded thumbnail
  may occur at import/replace time, but no downstream node, transform, analysis,
  material, or output preview evaluates until an explicit Run command captures a
  revision.

### 7.5 Load Image node

- **IMG-001 P0:** Output mode supports Color Image or Mask.
- **IMG-002 P0:** Mask source supports linear luminance, alpha, red, green, or blue.
- **IMG-003 P0:** Mask supports invert and clamp. Channel extraction occurs after
  source color interpretation; alpha extraction remains linear.
- **IMG-004 P0:** Missing alpha means alpha mask value 1 and is disclosed in the UI.
- **IMG-005 P1:** User may override input profile interpretation among embedded,
  sRGB, linear-sRGB, and ignore-profile modes; override is serialized.
- **IMG-006 P0:** Load Image exposes a node-local Browse/Replace command and accepts
  supported image files dropped directly on the node. Both use the same bounded
  signature validation, asset persistence, authored parameter update, and error
  reporting as toolbar import.
- **IMG-007 P0:** Pasting a clipboard image while the graph is active creates a
  Load Image node at visible framing center; pasting while one Load Image node is
  selected replaces that node. Non-image clipboard content creates no mutation.
- **IMG-008 P0:** Load Image reserves a stable in-node source preview and shows the
  actual decoded source thumbnail, filename, dimensions, and interpretation. Its
  empty/loading/error/result states do not move sockets or neighboring nodes.

### 7.6 Material node

- **MAT-001 P0:** Base Color is mandatory and accepts a color image or solid
  color. Solid color uses the common HSL picker and hex entry.
- **MAT-002 P0:** Opacity accepts an optional mask and multiplies base alpha.
- **MAT-003 P0:** Relief accepts one Normal or Height-compatible input. Multiple
  effects require explicit upstream merge, preventing ambiguous ordering.
- **MAT-004 P0:** Lights accept ordered multiple Light values. With none connected,
  the documented NW-to-SE default is active.
- **MAT-005 P0:** Material outputs a color image only. It must not expose 3D data,
  geometry, or camera controls.
- **MAT-006 P1:** Material controls include relief strength, ambient amount, diffuse
  amount, and preserve-luminance mix, with neutral defaults documented in the
  processing specification.

### 7.7 Resize node

- **RSZ-001 P0:** Width and height accept pixels and percentage; aspect ratio lock
  is on by default.
- **RSZ-002 P0:** Catalog includes nearest, area, bilinear, Hermite, B-spline,
  Catmull-Rom, Mitchell, Gaussian, and Lanczos 2/3/4.
- **RSZ-003 P0:** UI offers Auto, Pixel Art, Smooth, and Sharp presets plus the
  exact algorithm list. Auto resolves deterministically and stores both preset
  and resolved kernel version.
- **RSZ-004 P0:** A no-op resize returns an equivalent raster without filtering.
- **RSZ-005 P1:** Edge modes Clamp, Transparent, and Wrap are available.

### 7.8 Color and brightness correction nodes

- **CLR-001 P0:** Color Correction provides hue rotation, saturation, tint color,
  tint percentage, temperature, and tint-green/magenta controls.
- **CLR-002 P0:** Brightness Correction provides exposure, highlights, shadows,
  whites, and blacks.
- **CLR-003 P0:** Each neutral default must be an identity transform within numeric
  tolerance. Controls must not change alpha.
- **CLR-004 P0:** Hue and saturation use a documented color model; temperature and
  tint use a documented white-balance model rather than arbitrary channel offsets.
- **CLR-005 P1:** Each correction node accepts an optional mask controlling effect
  mix per pixel.

### 7.9 Merge node

- **MRG-001 P0:** Merge accepts Image A and Image B, labels the active foreground
  and background, and offers one-command Swap Layers.
- **MRG-002 P0:** Blend mode defaults to Normal and exposes the complete versioned
  standard catalog in the processing spec.
- **MRG-003 P0:** Node opacity and optional opacity mask modulate foreground alpha
  before source-over compositing.
- **MRG-004 P0:** Dimension mismatch behavior is explicit: canvas defaults to
  maximum width/height, images align center, outside pixels are transparent.
  P1 adds alignment and fit controls.
- **MRG-005 P1:** Creative modes use a separate labeled catalog and stable IDs.
- **MRG-006 P1:** Relief modifier mode accepts a standard Normal/Height input and
  zero or more lights. It shades Image A before blending with Image B; swapping
  layers updates the modified layer visibly.

### 7.10 Light node

- **LGT-001 P0:** Light outputs a Light value, not an image.
- **LGT-002 P0:** Controls are direction/azimuth, elevation, intensity, tint color,
  and tint percentage. Default tint is white.
- **LGT-003 P0:** Lights are parallel/infinite; no position, distance, falloff,
  cone, or shadow controls are shown.
- **LGT-004 P0:** Direction has both a spatial control and numeric fields.
- **LGT-005 P0:** Light order is deterministic. Additive diffuse contributions are
  accumulated in connected-edge order using sufficient precision.

### 7.11 Image to Single Color node

- **COL-001 P0:** Node displays representative color swatch, six-digit uppercase
  sRGB hex, and HSL rounded for display while retaining full precision internally.
- **COL-002 P0:** Optional target color uses the common picker and hex field.
- **COL-003 P0:** With a target, source and target appear side by side with signed
  hue/saturation/lightness deltas and unsigned CIEDE2000.
- **COL-004 P0:** Calculation operates on the full logical input, not the current
  zoomed preview; an equivalent streaming reduction is allowed.
- **COL-005 P1:** User may choose alpha weighting threshold and compare in Oklab as
  supplementary information.

### 7.12 Preview and export node

- **PVW-001 P0:** Preview accepts color image or mask and labels the interpretation.
  Mask view offers grayscale and false-color modes.
- **PVW-002 P0:** Preview supports fit, 100%, pan, zoom, checkerboard, pixel
  inspection, dimensions, color profile, and stale/computing state.
- **PVW-003 P0:** Export supports PNG and JPEG; TIFF is P1 after codec validation.
- **PVW-004 P0:** JPEG requires background color when source contains transparency
  and exposes quality. It never silently drops alpha against black.
- **PVW-005 P0:** PNG supports 8-bit RGBA at launch and optional workflow embedding.
  16-bit PNG is P1 after codec conformance.
- **PVW-006 P0:** Export is cancellable, reports progress, validates disk/memory
  estimates, and never replaces a completed file with a partial file. Export is
  capped at 32,768 pixels per dimension and 268 megapixels; the runtime memory
  budget may impose a lower operation-specific cap that is shown before work
  begins with a suggestion to resize.
- **PVW-007 P1:** TIFF supports 8/16-bit RGB/RGBA, compression choice, and profile
  metadata as validated by the selected codec.

### 7.13 Common HSL picker

- **CPK-001 P0:** Every product color choice uses one shared picker component and
  one color parser/serializer.
- **CPK-002 P0:** Picker provides hue, saturation, lightness, alpha where allowed,
  swatch, H/S/L numeric fields, and hex entry; edits stay bidirectionally synced.
- **CPK-003 P0:** Hue wraps to `[0,360)`; saturation/lightness clamp to `[0,100]`;
  invalid hex is described and does not commit.
- **CPK-004 P0:** Picker is fully keyboard operable, has direct entry, visible
  focus, accessible names/values, and 24 CSS pixel minimum targets or spacing.
- **CPK-005 P0:** Visual design must match the referenced approved design source
  when supplied. Until then, behavior and accessibility are normative while
  exact visual fidelity remains blocked, not invented.

### 7.14 Persistence and interchange

- **PER-001 P0:** Project changes autosave transactionally after at most 500 ms of
  inactivity; explicit Save flushes immediately.
- **PER-002 P0:** UI continuously exposes save state and whether storage is
  best-effort or persistent.
- **PER-003 P0:** App requests persistent storage after the first meaningful save,
  in user context, and handles denial without repeated prompting.
- **PER-004 P0:** Workflow JSON includes schema/app versions, graph, node bounds,
  z-order, values, states, edges, viewport, algorithm versions, project settings,
  and asset manifest sufficient for validation.
- **PER-005 P0:** Import validates schema and budgets before mutation, previews the
  project summary, and commits atomically.
- **PER-006 P0:** PNG embedding is optional and bounded; JSON export remains
  available regardless of PNG embedding.
- **PER-007 P0:** Same project opened in another tab cannot have two silent writers.
  The later tab is read-only until takeover is confirmed.
- **PER-008 P1:** Sequential migrations preserve the original backup and record a
  migration report. Future major versions open read-only.

## 8. Cross-Cutting Requirements

### Accessibility

- **A11Y-001 P0:** Product target is WCAG 2.2 AA for all principal workflows.
- **A11Y-002 P0:** Every drag operation has keyboard and command-based equivalent.
- **A11Y-003 P0:** Focus and selection are visually distinct; focus is visible,
  programmatic, and automatically brought fully enough into view.
- **A11Y-004 P0:** Text contrast is at least 4.5:1; required component/state
  visuals and ports are at least 3:1 against adjacent colors.
- **A11Y-005 P0:** Status and errors are announced without unexpected focus moves.
- **A11Y-006 P0:** Color is never the only signifier for port type, validity,
  selection, processing state, or comparison result.

### Privacy and security

- **SEC-001 P0:** Processing and persistence are local; network transmission of
  user content is disabled unless introduced by a separately approved feature.
- **SEC-002 P0:** Imported files and JSON are untrusted, bounded, signature/schema
  checked, and processed outside the UI thread.
- **SEC-003 P0:** Workflow import cannot execute code, fetch URLs, create HTML, or
  select arbitrary local files.
- **SEC-004 P0:** Export strips source EXIF and hidden transparent-pixel history by
  recomputing pixels; workflow metadata is included only with user-visible opt-in.
- **SEC-005 P0:** Production uses HTTPS, restrictive CSP, dependency lockfile,
  license inventory, and no `eval`/dynamic imported workflow code.

### Performance and reliability

- **NFR-001 P0:** Pointer/keyboard graph interaction targets 60 Hz; no authored
  input handler performs image processing or storage I/O synchronously.
- **NFR-002 P0:** On reference desktop hardware, p95 graph input response is under
  100 ms and first preview for the standard workload is under 500 ms after input
  settles. Full-resolution work may continue with visible status.
- **NFR-003 P0:** Evaluation is incremental; only changed nodes and downstream
  dependents recompute. Cache lookup is pure memory on the interaction path.
- **NFR-004 P0:** Every processing request is cancellable or supersedable; stale
  work cannot publish.
- **NFR-005 P0:** Memory use is bounded by workload tier and concurrency. When an
  operation exceeds budget, it fails before allocation with actionable options.
- **NFR-006 P0:** CPU output is deterministic for the same workflow/assets/app
  algorithm versions. Accelerated output remains inside documented tolerance.

## 9. Reference Workloads

| Tier | Assets | Graph | Purpose |
| --- | --- | --- | --- |
| Small | 8 images at 2K, <= 256 MiB decoded working set | 25 nodes / 35 edges | Minimum supported interactive baseline |
| Standard | 20 images at 4K, tiled; <= 1 GiB logical source data | 100 nodes / 160 edges | Performance acceptance target |
| Large | 40 images up to 8K, tiled and demand-loaded | 300 nodes / 500 edges | Graceful degradation and stress target |

Budgets use decoded and intermediate bytes, not compressed file size. The app
may cap tiers lower on constrained devices after a capability check, but must
explain the cap before destructive or expensive work.

## 10. Browser and Distribution Target

P0 targets the latest two stable major versions at release freeze of desktop
Chrome/Edge, Firefox, and Safari. Mobile browsers may open and inspect projects
but full authoring is not a P0 claim. The app is installable/offline-capable once
loaded, except for first retrieval of uncached application assets. WebGPU is never
required for support status.

## 11. Open Product Decisions

| ID | Decision needed | Default until resolved | Deadline |
| --- | --- | --- | --- |
| OQ-001 | Exact visual source for the HSL picker | Accessible behavioral spec only; UX owner assigned in M0 must obtain the source or secure stakeholder acceptance of behavior-only visuals without a parity claim | Before M8.2 visual token mapping |
| OQ-002 | Whether portable JSON embeds source assets | Manifest plus companion package; no base64 in plain JSON | Before interchange milestone |
| OQ-003 | Maximum embedded PNG workflow size | 5 MiB compressed, no source assets | Before PNG spike |
| OQ-004 | TIFF input in addition to required TIFF output | P1 if selected codec safely decodes it | Codec milestone |
| OQ-005 | Whether roughness gets a dedicated Material port | One typed Relief port with explicit interpretation | Before schema v1 freeze |

None of these blocks the product architecture. OQ-001 blocks only a visual
fidelity claim; OQ-002 through OQ-005 have reversible defaults recorded above.

## 12. Product Definition of Done

The product requirement outcome closes when every P0/P1 requirement maps to a
processing/runtime/UX contract, implementation milestone, and objective test;
all principal workflows include success, invalid input, cancellation, recovery,
and accessibility paths; and no behavior requires editing the seed to resolve an
ambiguity.