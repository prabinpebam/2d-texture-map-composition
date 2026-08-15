# Traceability, Decisions, and Risks

## 1. Purpose

This register proves coverage from the immutable seed through requirements,
contracts, implementation milestones, and verification. Source IDs summarize
the seed without replacing it; the seed remains the authority for original
intent.

## 2. Seed Traceability

| Source ID | Seed intent | Requirements/contracts | Milestone | Verification |
| --- | --- | --- | --- | --- |
| SRC-001 | Compose many texture-map images into one final 2D image | PRD product definition, AST/NOD requirements | M4-M9 | E2E-001, export decode |
| SRC-002 | No 3D output | non-goals, MAT-005, architecture separation | M7 | schema/UI audit for forbidden 3D concepts |
| SRC-003 | Node manager | GPH-001..010, graph runtime, UX graph model | M2 | DAG properties, keyboard graph E2E |
| SRC-004 | Load image as RGB image | IMG-001, import normalization | M4 | tagged/untagged/orientation fixtures |
| SRC-005 | Load image as mask | IMG-001..004, mask contract | M4 | E2E-003, scalar vectors |
| SRC-006 | Mask from luminosity/alpha/R/G/B | IMG-002..004, mask equations | M4 | five channel fixtures |
| SRC-007 | Material with mandatory base color/image | MAT-001, material node matrix | M7/M8 | material base image/color E2E |
| SRC-008 | Optional normal/opacity/relief inputs | MAT-002..006, canonical normal/height | M7 | normal/height/opacity fixtures |
| SRC-009 | Multiple lights and NW-SE default | MAT-004, LGT-001..005, lighting equations | M7 | E2E-002, direction/default/all-muted vectors |
| SRC-010 | Resize with all resampling methods | RSZ-001..005, versioned catalog v1 | M5 | E2E-004, mode distinctness and rings |
| SRC-011 | Hue/saturation/tint/temperature correction | CLR-001/004/005, Color Correction v1 | M5/M8 | identity and golden color vectors |
| SRC-012 | Exposure/highlights/shadows/whites/blacks | CLR-002..005, Brightness v1 | M5 | tonal vectors and identity properties |
| SRC-013 | Merge two images and exhaustive blends | MRG-001..005, standard/creative catalogs | M6 | E2E-005, W3C vectors, distinctness gate |
| SRC-014 | Toggle which layer is on top | MRG-001, UX Swap Layers | M6 | asymmetric swap fixture and serialization |
| SRC-015 | Opacity-map modifier | MRG-003, source alpha contract | M6 | alpha/mask vectors |
| SRC-016 | Normal/bump/displacement creative modifier | MRG-006, normal/height standardization | M7 | E2E-006 |
| SRC-017 | Flexible normal-map preprocessing | processing Section 7, manual override/suggestion | M7 | convention/swizzle/invalid corpus |
| SRC-018 | Arbitrary image accepted as normal creatively | arbitrary-image height fallback and warning | M7 | arbitrary photo reproducibility test |
| SRC-019 | Arbitrary image accepted as bump via grayscale | height derivation and IMG mask rules | M7 | luminance/height vectors |
| SRC-020 | Global lighting affects relief | explicit light-set shading, no hidden graph scan | M7 | graph dependency and light vectors |
| SRC-021 | Parallel infinite light intensity/tint/mix/direction | LGT-001..005, light contract | M7/M8 | light numeric/UI tests |
| SRC-022 | Image to one representative color | COL-001..005, alpha-weighted mean | M8 | E2E-007, numeric reduction |
| SRC-023 | Show HSL and hex | COL-001, representative serialization | M8 | HSL/hex vectors |
| SRC-024 | Optional target, side-by-side comparison | COL-002/003, Preview compare | M8 | E2E-007 visual/hit-test |
| SRC-025 | Show HSL delta from target | COL-003, signed delta equations | M8 | hue wrap/achromatic tests |
| SRC-026 | Preview images and masks | PVW-001/002, preview pipeline | M4 | actual-pixel and mask-view E2E |
| SRC-027 | Download TIFF/PNG/JPG | PVW-003..007, codec architecture | M1/M9 | E2E-011, independent decoders |
| SRC-028 | Shared HSL picker matching design source | CPK-001..005, UX picker dependency | M8 | keyboard/semantic plus source parity review |
| SRC-029 | React Flow node UI | selected stack, React Flow adapter | M0/M2 | graph component/integration suite |
| SRC-030 | Light/dark mode | PRJ-004, semantic theme tokens | M0 | theme/state contrast and screenshots |
| SRC-031 | Minimap navigation | GPH-007, UX zoom/navigation | M2 | keyboard/pointer/hit-test |
| SRC-032 | Save files in IndexedDB | PER-001..008, DB schema | M3 | crash/quota/reopen tests |
| SRC-033 | Save workflow JSON including size/position | PER-004/005, workflow schema | M2/M3/M9 | structural round-trip |
| SRC-034 | Exact workflow snapshot recreation | PRD WF-001, algorithm/schema versions | M3/M9 | semantic recompute round-trip |
| SRC-035 | Embed workflow JSON in PNG | PER-006, PNG envelope | M1/M9 | valid/stripped/corrupt/oversized corpus |
| SRC-036 | All nodes bypass/mute/lock/resize | GPH-005/006, NOD-005, UX node states | M2 then each node | E2E-008 and node matrix |
| SRC-037 | Remember node state/position/size/layer/values instantly | GPH-008, authored state/autosave | M2/M3 | command and reload round-trip |
| SRC-038 | Standard zoom/fit/pan controls and shortcuts | GPH-007, UX zoom navigation | M2 | keyboard/pointer E2E |
| SRC-039 | React Flow web app tech stack | selected stack | M0 | dependency/build evidence |
| SRC-040 | Complete detailing plan distinct from implementation plan | Detailing Plan and Implementation Plan | documentation phase | document distinction audit |
| SRC-041 | Deep research, skills, design system, practices, security/performance/edges | Research, UX, architecture, quality docs | documentation/M1/M10 | source matrix and cross-cutting gates |
| SRC-042 | Agent graph-and-loop execution | Detailing Plan outcome graph and milestone loops | all | definitions of done and reopen evidence |

No actionable seed statement is intentionally unmapped.

### Post-seed user directives

| Source ID | Directive | Requirements/contracts | Milestone | Verification |
| --- | --- | --- | --- | --- |
| USR-001 | Controls and previews live directly in nodes; inspector remains optional/secondary; node management and workflow running follow familiar ComfyUI behavior | NOD-002/007/008/009, EXE-001..008, UX node-first amendment, Architecture explicit run queue | R1 then M5-M10 | E2E-013..017, 25/100/300-node performance, node/inspector parity |

`USR-001` is captured normatively in
`10-node-first-workbench-update.md`. It changes derived product behavior without
editing the immutable seed.

## 3. Requirement-to-Contract Summary

| Requirement family | Normative contract | Verification family |
| --- | --- | --- |
| PRJ/GPH/NOD | UX Sections 2-6; Architecture Sections 3-6 | graph unit/property/component/E2E |
| AST/IMG | Processing Sections 3-5; Architecture security | import corpus, E2E-003, fuzz |
| MAT/LGT/MRG relief | Processing Sections 7-8, 12, 17 | normal/light/material vectors, E2E-002/006 |
| RSZ | Processing Section 6 | catalog conformance, E2E-004 |
| CLR | Processing Sections 9-10 | identity/golden/property tests |
| MRG blends | Processing Section 11 | W3C/scalar/golden/distinctness, E2E-005 |
| COL/CPK | Processing Section 13; UX Section 8 | numeric, component a11y, E2E-007 |
| PVW/export | Processing Section 14; Architecture codec/envelope | actual pixels and artifact decoders |
| PER | Architecture Sections 9-14 | crash/quota/migration/tab/round-trip |
| A11Y | UX Sections 2-13 | automated plus manual accessibility |
| SEC | Architecture Section 15 | fuzz/CSP/network/metadata/dependency audit |
| NFR | Architecture Sections 4-8, 16-17 | repeated workloads and fault injection |

## 4. Decision Register

| ID | Status | Decision | Rationale / reopen trigger |
| --- | --- | --- | --- |
| DEC-001 | Accepted | Canonical color is linear-sRGB float32 straight alpha. | Standards-grounded correctness; reopen only for validated wide-gamut project scope. |
| DEC-002 | Accepted | CPU scalar is oracle; Rust/WASM is production CPU; WebGPU optional. | Keeps correctness/support independent of GPU; reopen if WASM spike fails replacement criteria. |
| DEC-003 | Accepted | “All” means versioned standard plus creative catalogs. | Makes scope enumerable/testable; add modes by catalog version, not vague completion. |
| DEC-004 | Accepted | Explicit typed relief preserves normal versus height semantics. | Forgiving UI without incorrect internal equivalence. |
| DEC-005 | Accepted | Lights are explicit edges; default is local to unconnected Material. | Reproducibility; avoids hidden graph-wide dependency. |
| DEC-006 | Accepted | IndexedDB snapshots/assets with reported durability and JSON portability. | Browser storage can be evicted; JSON is escape hatch. |
| DEC-007 | Accepted | PNG envelope is optional/bounded and never pixel-import critical. | Ancillary metadata can be stripped or ignored. |
| DEC-008 | Accepted | Graph is one keyboard composite with non-drag dialogs. | Large-graph usability and WCAG 2.2 dragging requirement. |
| DEC-009 | Accepted | Requested Ctrl shortcuts are best-effort plus reliable UI/remappable alternates. | Browser-reserved shortcuts cannot be a sole contract. |
| DEC-010 | Provisional | Plain JSON references assets; future package may embed them. | Avoid huge base64 JSON; reopen before M9 after packaging prototype. |
| DEC-011 | Blocked visual only | Exact HSL picker visuals wait for approved design source. | SPIKE-008 found no approved source; exact similarity cannot be derived from absent evidence. |
| DEC-012 | Rejected pending replacement | TIFF remains hidden because no managed-feed candidate proves maintained 8/16-bit RGBA browser encoding. | SPIKE-001 and ADR-005. |
| DEC-013 | Accepted | Validation loops are mandatory Playwright UX evaluations that open the actual app and prove the intended user task, not functional code test loops. | Prevents unit/build/DOM-only evidence from closing user-experience outcomes. |
| DEC-014 | Accepted | Common controls and output previews are node-local; inspector is a schema-driven secondary detail/multi-edit surface. | User directive USR-001 and ComfyUI property/output-node familiarity; reopen only if objective large-graph or accessibility gates cannot be met with detail reduction. |
| DEC-015 | Accepted | Workflow execution is explicit: Run/partial-run creates immutable queue records distinct from authored edits and draft previews. | Prevents implicit background work from masquerading as a completed workflow and enables observable cancel/cache/stale behavior. |
| DEC-016 | Accepted | ComfyUI is a behavioral reference, not a visual/template dependency. | Preserve TextureFlow domain, design tokens, typed math, and accessibility while adopting familiar node management/execution principles. |

## 5. Risk Register

| Risk ID | Risk | Likelihood / impact | Mitigation and trigger |
| --- | --- | --- | --- |
| RSK-001 | Large decoded/intermediate images exceed browser memory | High / Critical | tiles, reservations, caps, cancellation; trigger on M1/M4 workload OOM |
| RSK-002 | TIFF WASM codec is unmaintained, incompatible, or memory-heavy | Medium / High | SPIKE-001 and replacement adapter; adjust P1 capabilities, never fake format |
| RSK-003 | Browser color decode hides/discards profiles inconsistently | Medium / High | tagged fixture spike and explicit warnings/overrides; narrow P0 if needed |
| RSK-004 | WebGPU divergence/device loss corrupts output | Medium / High | startup parity, error scopes, CPU retry; disable backend session |
| RSK-005 | IndexedDB eviction/quota causes data loss expectation gap | Medium / Critical | persist request, durability UI, JSON export, transactional snapshots |
| RSK-006 | Autosave churn blocks interaction/storage | Medium / High | independent worker/debounce/incremental snapshot measurement |
| RSK-007 | React Flow rerenders degrade large graph | Medium / High | minimal subscriptions/stable props/LOD/stress gate at M2 |
| RSK-008 | PNG metadata is stripped or becomes oversized | High / Medium | optional bounded envelope and sidecar JSON; pixel import independent |
| RSK-009 | Malformed images/profiles/JSON exhaust or exploit parser | Medium / Critical | signatures, dimensions, budgets, worker isolation, fuzz, current codecs |
| RSK-010 | “All blend/resampling” expands without closure | High / High | catalog IDs/version and traceability; new algorithm requires formula/fixture |
| RSK-011 | Normal convention heuristic produces inverted relief | High / Medium | explicit manual convention and reversible suggestion, never silent lock |
| RSK-012 | Requested shortcuts conflict with browser/AT | High / Medium | reliable controls, remapping, conflict-free alternates, focus scoping |
| RSK-013 | Node graph is nominally ARIA-labeled but unusable | Medium / High | composite/non-drag model and manual keyboard/screen-reader gates |
| RSK-014 | Tiled kernels show seams or differ from full frame | Medium / High | halo contract and tile-size/order conformance fixtures |
| RSK-015 | Schema migration silently changes appearance | Medium / Critical | independent algorithm versions, old implementation retention, explicit upgrade |
| RSK-016 | Hidden data remains in transparent pixels or EXIF | Medium / High | canonical transparent black and export re-encode/metadata allowlist |
| RSK-017 | HSL picker parity claim is invented without source | Current / High | blocked decision and source-based review before claim |
| RSK-018 | Optional shared memory headers break asset/embed scenarios | Medium / Medium | transferables baseline; COOP/COEP optimization only |
| RSK-019 | Rich node widgets/previews make large graphs unreadable or slow | High / High | schema compactness tiers, collapse/zoom detail policy, stable dimensions, 25/100/300-node actual-app gates |
| RSK-020 | Node and inspector controls drift into two implementations | High / High | one widget schema/component source; parity tests for key/default/validation/undo/serialization |
| RSK-021 | Implicit draft preview is confused with workflow execution/current result | High / High | explicit run IDs and queue records; distinct draft/run/result state; stale revision publication gate |
| RSK-022 | Interactive widgets drag/pan nodes or make keyboard focus unusable | High / High | no-drag/no-pan ownership, roving graph focus, widget keyboard paths, pointer hit-test and 200% zoom evaluation |
| RSK-023 | Queue/history grows without bounds or becomes authored workflow state | Medium / Medium | bounded ephemeral history, result handle release, workflow schema exclusion, retention settings |

Risk owners are assigned when implementation roles are staffed. Critical risks
cannot be accepted without explicit product/engineering review and user-visible
failure behavior.

## 6. Open Questions

| ID | Question | Current disposition | Closure evidence |
| --- | --- | --- | --- |
| OQ-001 | Where is the picker design source? | Blocks exact visual implementation only. | accessible source/context and state screenshots |
| OQ-002 | Should workflows package source assets? | Plain JSON manifest; prototype package later. | size/usability/security benchmark and decision |
| OQ-003 | Which TIFF codec and options pass? | P1 gated. | SPIKE-001 report |
| OQ-004 | Is 5 MiB PNG workflow cap appropriate? | Provisional default. | real workflow size distribution and tool interop |
| OQ-005 | Is roughness a separate visible Material port? | One Relief port with interpretation. | usability test before schema v1 freeze |

## 7. Audit Checklist

- [x] Seed preserved as immutable reference.
- [x] Detailing and implementation plans are separate documents.
- [x] Every seed requirement has a traceability row.
- [x] Every requirement family has a normative contract and verification family.
- [x] Security, privacy, accessibility, performance, recovery, browser support,
  persistence, and edge cases are cross-cutting gates.
- [x] Blend/resampling/normal/light/color semantics are bounded and versioned.
- [x] Implementation milestones are dependency ordered with objective exit evidence.
- [x] Actual-app Playwright UX evaluation is a mandatory milestone and release gate.
- [ ] HSL picker design source obtained and mapped.
- [x] M1 implementation spikes executed and ADR dispositions finalized.
- [ ] Implementation and release evidence produced.

The unchecked items are intentionally implementation-phase outcomes. They do not
indicate missing detailing; they prevent premature claims that blocked evidence or
the production application already exists.

## 8. Detailing Project Evaluation

The specification set is ready for implementation when document validation
passes, all internal IDs/references are consistent, the seed diff is empty, and
an independent review finds no blocking ambiguity in a P0 workflow, node formula,
state transition, schema, milestone, or release oracle. Any finding reopens only
the smallest responsible document/workstream and this audit is rerun afterward.